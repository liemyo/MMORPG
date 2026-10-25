#!/bin/sh
# Jalankan Veyra di http://localhost:8790
cd "$(dirname "$0")"
(sleep 1 && open "http://localhost:8790") &
exec python3 -m http.server 8790
