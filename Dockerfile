# Stage 1: build the website
FROM node:20-slim AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend ./
# Optional: bake a demo password into the sign-in cards (one-click demo logins). Leave empty to type it instead.
ARG VITE_DEMO_PASSWORD=""
ENV VITE_DEMO_PASSWORD=$VITE_DEMO_PASSWORD
RUN npm run build

# Stage 2: the API, serving the built website
FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend backend
COPY data data
COPY --from=web /app/frontend/dist frontend/dist
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
