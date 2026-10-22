# Load-Balanced Node.js (Express) Backend with Nginx Reverse Proxy

An Express.js backend running across **3 server instances** (`3000`, `3001`, `3002`) behind an **Nginx Reverse Proxy & Load Balancer** (`C:\nginx-1.30.2`) on port `8088`.

## Architecture

```
            Client Request (http://localhost:8088)
                              │
                              ▼
             Nginx Load Balancer (Port 8088)
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
   Instance 1         Instance 2         Instance 3
(127.0.0.1:3000)   (127.0.0.1:3001)   (127.0.0.1:3002)
```

## 1. Run the Load-Balanced Node.js Backend

Starting the app launches all 3 backend instances (`3000`, `3001`, `3002`) automatically:

```powershell
npm start
```

Or run individual instances in separate terminals if you want to test stopping/starting one server to see Nginx automatic failover:

```powershell
npm run start:3000
npm run start:3001
npm run start:3002
```

## 2. Start & Manage Nginx (`C:\nginx-1.30.2`)

```powershell
# Test the nginx.conf syntax
npm run nginx:test

# Start Nginx in the background
npm run nginx:start

# Reload Nginx configuration after making changes
npm run nginx:reload

# Stop Nginx gracefully
npm run nginx:stop
```

## 3. Test the Load Balancer (Port 8088)

Send 4 consecutive requests to `http://localhost:8088/` and watch `servedBy.port` cycle through `3000` $\rightarrow$ `3001` $\rightarrow$ `3002` $\rightarrow$ `3000`:

```powershell
1..4 | ForEach-Object { (Invoke-RestMethod -Uri "http://localhost:8088/").servedBy }
```

## 4. Load Balancing Algorithms in `nginx.conf`

Inside `upstream nodejs_backend` in `nginx.conf`:
- **Round Robin (Default)**: Distributes requests sequentially across `3000`, `3001`, and `3002`.
- **Least Connections (`least_conn;`)**: Sends each new request to the server with the fewest active connections.
- **IP Hash (`ip_hash;`)**: Routes requests from the same client IP to the same backend instance.
- **Weighted (`server 127.0.0.1:3000 weight=3;`)**: Sends proportionally more traffic to specific servers.
