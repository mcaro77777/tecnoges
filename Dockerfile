FROM nginx:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html ms-tecnologia.css futuristic.css gesfru-authentic.css gesfru-site.js gesfru-motion.js ms-tecnologia-hero.webm ms-tecnologia-hero.mp4 ms-tecnologia-poster.jpg /usr/share/nginx/html/
COPY assets/ /usr/share/nginx/html/assets/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
