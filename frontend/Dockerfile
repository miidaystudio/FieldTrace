# FieldTrace dashboard + driver PWA — static build served by nginx, which also proxies the API
# (REST + Socket.IO) so the browser talks to one origin (same-site refresh cookie, no CORS).
# Build:  docker build -t fieldtrace-web ./frontend
# Run:    docker run -e API_UPSTREAM=http://api:4000 -p 8080:80 fieldtrace-web

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
ENV API_UPSTREAM=http://api:4000
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
