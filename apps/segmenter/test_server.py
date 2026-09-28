import concurrent.futures
import importlib.util
import json
from pathlib import Path
import threading
import time
import unittest
import urllib.error
import urllib.request

spec = importlib.util.spec_from_file_location("segmenter", Path(__file__).with_name("server.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Contracts(unittest.TestCase):
    def test_utf16_budgets(self):
        self.assertEqual(module.validate_texts({"texts": ["😀" * 2048]}), ["😀" * 2048])
        for body in [{"texts": ["😀" * 2049]}, {"texts": ["a"] * 65},
                     {"texts": ["a" * 4000] * 3}, {"texts": [""]},
                     {"texts": ["\ud800"]}, {"texts": [3]}, {"texts": ["x"], "extra": 1}]:
            with self.assertRaises(ValueError):
                module.validate_texts(body)

    def test_output_identity(self):
        self.assertEqual(module.validate_tokens(["科学课"], [["科学", "课"]]), [["科学", "课"]])
        for output in [[["科学"]], [["科学课", ""]], [[1]], [], ["科学课"]]:
            with self.assertRaises(ValueError):
                module.validate_tokens(["科学课"], output)

    def test_loopback_http(self):
        engine = module.Engine(lambda: lambda texts: [list(t) for t in texts], "test-cpu")
        for _ in range(100):
            if engine.ready:
                break
            time.sleep(.01)
        server = module.BoundedServer(("127.0.0.1", 0), engine)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        base = "http://127.0.0.1:" + str(server.server_port)
        try:
            with urllib.request.urlopen(base + "/health") as reply:
                self.assertTrue(json.load(reply)["ready"])
            request = urllib.request.Request(base + "/segment", json.dumps({"texts": ["边长", "😀"]}).encode(), {"Content-Type": "application/json"})
            with urllib.request.urlopen(request) as reply:
                self.assertEqual(json.load(reply)["tokens"], [["边", "长"], ["😀"]])
            request = urllib.request.Request(base + "/segment", b'{"texts":[""]}', {"Content-Type": "application/json"})
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(request)
            self.assertEqual(error.exception.code, 400)
        finally:
            server.shutdown()
            server.server_close()

    def test_expired_queue_and_single_model(self):
        release = threading.Event()
        active = []
        def model(texts):
            if texts != ["科学课"]:
                active.append(texts)
                release.wait(1)
            return [list(t) for t in texts]
        engine = module.Engine(lambda: model, "test-cpu", timeout=2, fatal=lambda code: None)
        for _ in range(100):
            if engine.ready:
                break
            time.sleep(.01)
        first = engine.submit(["一"])
        for _ in range(100):
            if active:
                break
            time.sleep(.01)
        second = engine.submit(["二"])
        second.cancel()
        release.set()
        self.assertEqual(first.result(1), [["一"]])
        engine.jobs.join()
        self.assertEqual(active, [["一"]])


if __name__ == "__main__":
    unittest.main()
