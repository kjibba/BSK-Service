### Multi-stage build: build frontend with node, then copy into nginx
FROM node:20-alpine AS builder
WORKDIR /app
# copy package files first for cached install
COPY frontend/package.json frontend/package-lock.json* ./frontend/  
COPY frontend/ ./frontend/
WORKDIR /app/frontend
RUN npm install --silent && npm run build

FROM nginx:stable-alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY ./nginx/nginx.conf /etc/nginx/conf.d/default.conf
# Optional: copy ssl certs if present
COPY ./nginx/ssl /etc/nginx/ssl
# Optional: copy any extra SSL server blocks (picked up by include *.ssl.conf)
COPY ./nginx/*.ssl.conf /etc/nginx/conf.d/

# expose port only for internal reference; mapping to host done in compose
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
