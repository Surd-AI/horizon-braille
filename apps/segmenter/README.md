# Optional HanLP segmenter

This standalone loopback service provides word proposals to the Node API.
It is not imported by the offline TypeScript core. It exposes `GET /health`
(`ready`, `model`, `device`) and `POST /segment` with exactly
`{"texts":["计算直角三角形的边长"]}`. Success returns
`{"model":"FINE_ELECTRA_SMALL_ZH:20220615_231803","tokens":[[...]]}`.

Only `127.0.0.1` is bound. Use a private tunnel or colocated proxy; do not
publish the port. No tokens, hostnames, production configuration or source
documents belong in this directory. Request bodies are never logged.

## Model and license

Use the exact official checkpoint
`https://file.hankcs.com/hanlp/tok/fine_electra_small_20220615_231803.zip`.
The author explicitly grants this named model Apache-2.0 in
<https://bbs.hankcs.com/t/topic/1551> (2023-06-02). HanLP code is Apache-2.0;
preserve its and all dependencies' notices. Model weights are downloaded
separately, never included in this repository/package. The coarse model's
earlier local benchmark is not this fine model's output or performance.
The tested ZIP SHA-256 is
`7507b02698f09ce8aca356f82bb4dd137f460973dc56a96410676bf22718149a`.

## Runtime

`requirements.txt` is a legacy Python 3.8/Pascal compatibility profile. Install
Torch from the official CUDA 11.3 wheel index before the remaining requirements:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install 'pip==25.0.1' 'setuptools==69.5.1' 'wheel==0.43.0'
.venv/bin/python -m pip install 'torch==1.12.1+cu113' --extra-index-url https://download.pytorch.org/whl/cu113
.venv/bin/python -m pip install --no-build-isolation -r requirements.txt -c constraints-py38.txt
.venv/bin/python server.py --model-path /absolute/path/to/fine_electra_small_20220615_231803 --gpu-index 1
```

Check that the selected physical GPU is free and supported before launching.
`CUDA_VISIBLE_DEVICES` restricts the model to the selected GPU; its logical
CUDA index is then zero. CPU thread counts are two, with one interop thread.
No system driver, production environment or existing supervisor modification
is needed. A process manager should restart only this isolated service.
Wait for ready health before forwarding traffic. Run the dependency-free
contract tests with `python test_server.py`.

Keep a private deployment manifest with the checkpoint ZIP SHA-256, extracted
configuration, `pip freeze`, selected device, service command and readiness test.
The response model label alone is not proof of which weights were loaded.
Do not reuse a production virtualenv; if an installed binary is copied for
offline installation, use independent files and verify source/destination hashes.

For user-level persistence, an owned launcher can hold an advisory lock, check
its recorded PID and command, check the selected GPU is otherwise unused, then
start only this service. Preserve existing crontab contents and add an identifiable
single marker. Rollback: disable that launcher first, remove only its marked cron
line, verify the PID's owner and exact service path, and terminate that owned PID.
Retain the model/environment for diagnosis; never stop unrelated GPU processes,
replace drivers or rewrite the rest of the user's crontab.

## Limits and failure behavior

- At most 64 nonempty strings, 4096 UTF-16 units each, 10000 total; reject lone
  surrogates and bodies over 64 KiB. JSON only; reject chunked/duplicate length headers.
- One model worker, two pending jobs and at most eight HTTP connections.
  Input-read socket timeout five seconds; inference deadline twenty seconds.
- Output must exactly reconstruct each input and is capped at 128 KiB.
  Invalid output fails closed; it is never substituted for the input.
- Timed-out queued work is discarded. A stuck running model call exits only
  this service so its owned launcher can restart it; startup has a 240-second
  watchdog. The Node proxy has a shorter deadline and retains local conversion
  when this service is unavailable. Requests need no retries inside this service.

These are generic Chinese word proposals, not certified braille word-joining
rules. Callers retain source identity, validate boundaries and preserve manual
edits and formula islands. Do not infer full standard coverage from a successful
HTTP response or generic segmentation benchmark.
