# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app

# Reuse the dependency layer and npm downloads until package manifests change.
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --include=dev

COPY . .
ENV ELEVENTY_ENV=production
RUN npm run build

FROM nginx:stable-alpine AS runtime

# Ship generated static files, not Node.js or build dependencies.
COPY --from=build /app/_site /usr/share/nginx/html
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD busybox wget -q -T 2 -O /dev/null http://127.0.0.1/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
