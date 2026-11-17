FROM node:22-alpine AS build

WORKDIR /app

COPY build.mjs index.html site.css site.js ./
COPY assets/ ./assets/

RUN node build.mjs

FROM nginx:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
