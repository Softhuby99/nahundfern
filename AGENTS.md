# Project Architecture

- Treat stored map route geometry as untrusted input and fall back to a generated route when any coordinate is invalid, because one malformed point must never crash a travel report.