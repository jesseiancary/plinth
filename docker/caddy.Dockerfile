# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Caddy Reverse Proxy Dockerfile (Development Only)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
# Purpose:
#   Development reverse proxy for routing traffic to API and Web services.
#   Production uses AWS ALB/CloudFront - Caddy is NOT used in production.
#
# Usage:
#   - Caddyfile is volume-mounted from caddy/Caddyfile.local
#   - Auto-generates self-signed certificate for localhost
#   - Routes /api/* to API container, /* to Web container
#
# Build:
#   docker build -f docker/caddy.Dockerfile -t plinth-caddy .
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FROM caddy:2.8-alpine

# Add metadata
LABEL org.opencontainers.image.title="Plinth Caddy"
LABEL org.opencontainers.image.description="Development reverse proxy for Plinth SaaS"
LABEL org.opencontainers.image.authors="Plinth Team"

# Install curl for healthchecks
RUN apk add --no-cache curl

# Expose HTTP and HTTPS ports
EXPOSE 80 443

# Use default Caddy entrypoint
# Caddyfile will be volume-mounted at /etc/caddy/Caddyfile
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
