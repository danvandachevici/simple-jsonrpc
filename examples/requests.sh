#/bin/bash
set -x

curl -X POST -H "content-type: application/json" -d '{"jsonrpc": "2.0", "id": 3, "method": "add", "params":{}}' http://localhost:9615/api/test
echo
curl -X POST -H "content-type: application/json" -d '{"jsonrpc": "2.0", "id": 3, "method": "add", "params":{"a": 0}}' http://localhost:9615/api/test
echo
curl -X POST -H "content-type: application/json" -d '{"jsonrpc": "2.0", "id": 3, "method": "add", "params":{"a": 3, "b": "string"}}' http://localhost:9615/api/test
echo
curl -X POST -H "content-type: application/json" -d '{"jsonrpc": "2.0", "id": 3, "method": "add", "params":{"a": "string", "b": "string"}}' http://localhost:9615/api/test
echo
curl -X POST -H "content-type: application/json" -d '{"jsonrpc": "2.0", "id": 3, "method": "add", "params":{"a": 3, "b": 5}}' http://localhost:9615/api/test
echo
