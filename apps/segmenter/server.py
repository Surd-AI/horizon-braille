"""Loopback-only, bounded HanLP service. Importing this module loads no model."""
import argparse
import concurrent.futures
import json
import os
import queue
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn

MODEL = "FINE_ELECTRA_SMALL_ZH:20220615_231803"
MAX_BODY = 65536
MAX_TEXTS = 64
MAX_CHARS = 10000
MAX_SINGLE = 4096
MAX_RESPONSE = 131072


def validate_texts(value):
    if not isinstance(value, dict) or set(value) != {"texts"}:
        raise ValueError("expected texts")
    texts = value["texts"]
    if not isinstance(texts, list) or not 1 <= len(texts) <= MAX_TEXTS:
        raise ValueError("invalid text count")
    if any(not isinstance(s, str) or not s or
           any(0xD800 <= ord(c) <= 0xDFFF for c in s) for s in texts):
        raise ValueError("invalid text")
    units = [len(s.encode("utf-16-le")) // 2 for s in texts]
    if any(n > MAX_SINGLE for n in units) or sum(units) > MAX_CHARS:
        raise ValueError("text budget exceeded")
    return texts


def validate_tokens(texts, tokens):
    if not isinstance(tokens, list) or len(tokens) != len(texts):
        raise ValueError("invalid model output")
    for source, row in zip(texts, tokens):
        if not isinstance(row, list) or not row or len(row) > len(source):
            raise ValueError("invalid token row")
        if any(not isinstance(t, str) or not t for t in row) or "".join(row) != source:
            raise ValueError("model changed source")
    return tokens


class Engine:
    def __init__(self, loader, device, timeout=20, fatal=os._exit):
        self.ready = False
        self.failed = False
        self.device = device
        self.timeout = timeout
        self.fatal = fatal
        self.jobs = queue.Queue(maxsize=2)
        self.thread = threading.Thread(target=self._run, args=(loader,), daemon=True)
        self.thread.start()

    def _run(self, loader):
        startup_watchdog = threading.Timer(240, self.fatal, args=(72,))
        startup_watchdog.daemon = True
        startup_watchdog.start()
        try:
            model = loader()
            validate_tokens(["科学课"], model(["科学课"]))
            self.ready = True
            print("segmenter ready: " + MODEL + " " + self.device, flush=True)
        except Exception as error:
            self.failed = True
            print("model startup failed: " + type(error).__name__, flush=True)
            self.fatal(70)
            return
        finally:
            startup_watchdog.cancel()
        while True:
            texts, deadline, future = self.jobs.get()
            try:
                if time.monotonic() >= deadline or not future.set_running_or_notify_cancel():
                    continue
                # Python cannot stop a hung CUDA call. Terminate only this owned
                # service; the isolated launcher restarts it. Never queue forever.
                watchdog = threading.Timer(max(0.01, deadline - time.monotonic()), self.fatal, args=(71,))
                watchdog.daemon = True
                watchdog.start()
                try:
                    result = validate_tokens(texts, model(texts))
                    future.set_result(result)
                except Exception as error:
                    future.set_exception(ValueError(type(error).__name__))
                finally:
                    watchdog.cancel()
            finally:
                self.jobs.task_done()

    def submit(self, texts):
        future = concurrent.futures.Future()
        self.jobs.put_nowait((texts, time.monotonic() + self.timeout, future))
        return future


class BoundedServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    request_queue_size = 8

    def __init__(self, address, engine):
        self.engine = engine
        self.connections = threading.BoundedSemaphore(8)
        super().__init__(address, Handler)

    def process_request(self, request, address):
        if not self.connections.acquire(blocking=False):
            try:
                request.sendall(b"HTTP/1.0 503 Service Unavailable\r\nContent-Length: 0\r\n\r\n")
            finally:
                self.shutdown_request(request)
            return
        try:
            super().process_request(request, address)
        except BaseException:
            self.connections.release()
            raise

    def process_request_thread(self, request, address):
        try:
            super().process_request_thread(request, address)
        finally:
            self.connections.release()


class Handler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(5)

    def log_message(self, *args):
        pass  # Never log source strings or request bodies.

    def reply(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        if len(body) > MAX_RESPONSE:
            status, body = 502, b'{"error":"output-too-large"}'
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
        except (OSError, TimeoutError):
            pass

    def do_GET(self):
        if self.path != "/health":
            return self.reply(404, {"error": "not-found"})
        engine = self.server.engine
        return self.reply(200 if engine.ready else 503,
                          {"ready": engine.ready, "model": MODEL, "device": engine.device})

    def do_POST(self):
        if self.path != "/segment":
            return self.reply(404, {"error": "not-found"})
        if self.headers.get("Transfer-Encoding") or self.headers.get_content_type() != "application/json":
            return self.reply(400, {"error": "invalid-body"})
        try:
            lengths = self.headers.get_all("Content-Length", [])
            if len(lengths) != 1 or not lengths[0].isdigit():
                raise ValueError()
            length = int(lengths[0])
            if not 0 < length <= MAX_BODY:
                return self.reply(413, {"error": "body-too-large"})
            data = self.rfile.read(length)
            if len(data) != length:
                raise ValueError()
            texts = validate_texts(json.loads(data.decode("utf-8")))
        except (ValueError, UnicodeError, OSError):
            return self.reply(400, {"error": "invalid-body"})
        engine = self.server.engine
        if not engine.ready:
            return self.reply(503, {"error": "not-ready"})
        try:
            future = engine.submit(texts)
        except queue.Full:
            return self.reply(503, {"error": "busy"})
        try:
            tokens = future.result(timeout=engine.timeout)
            return self.reply(200, {"model": MODEL, "tokens": tokens})
        except concurrent.futures.TimeoutError:
            future.cancel()
            return self.reply(504, {"error": "inference-timeout"})
        except Exception:
            return self.reply(502, {"error": "invalid-model-output"})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--port", type=int, default=8791)
    parser.add_argument("--gpu-index", type=int, default=1)
    args = parser.parse_args()
    if args.gpu_index < 0:
        parser.error("GPU index must be nonnegative")
    os.environ["CUDA_VISIBLE_DEVICES"] = str(args.gpu_index)
    os.environ["CUDA_DEVICE_ORDER"] = "PCI_BUS_ID"
    os.environ["OMP_NUM_THREADS"] = "2"
    os.environ["MKL_NUM_THREADS"] = "2"

    def load_model():
        import torch
        import hanlp
        torch.set_num_threads(2)
        torch.set_num_interop_threads(1)
        if not torch.cuda.is_available() or torch.cuda.device_count() != 1:
            raise RuntimeError("Selected GPU unavailable")
        # Visible device 0 maps exclusively to the physical GPU selected above.
        return hanlp.load(args.model_path, devices=0)

    engine = Engine(load_model, "cuda:physical:" + str(args.gpu_index))
    server = BoundedServer(("127.0.0.1", args.port), engine)
    server.serve_forever(poll_interval=0.5)


if __name__ == "__main__":
    main()
