FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx ng build --configuration=production

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
# runtime-config.json (identifiant Google) écrit au démarrage depuis GOOGLE_CLIENT_ID
COPY --chmod=755 runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]