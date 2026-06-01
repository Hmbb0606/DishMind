ARG NODE_IMAGE=docker.m.daocloud.io/library/node:20-bookworm-slim

FROM ${NODE_IMAGE} AS frontend-builder

ARG NPM_REGISTRY=https://registry.npmmirror.com

WORKDIR /app/frontend

RUN npm config set registry "${NPM_REGISTRY}"

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build && npm prune --omit=dev

FROM ${NODE_IMAGE} AS runtime

ARG APT_MIRROR=mirrors.aliyun.com
ARG PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple
ARG PIP_TRUSTED_HOST=pypi.tuna.tsinghua.edu.cn
ARG PYTORCH_CPU_INDEX_URL=https://download.pytorch.org/whl/cpu

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PORT=3000 \
    PYTHON_BRIDGE_MODE=direct \
    PYTHON_BIN=python \
    HF_ENDPOINT=https://hf-mirror.com \
    HF_HOME=/app/.cache/huggingface \
    SENTENCE_TRANSFORMERS_HOME=/app/.cache/sentence_transformers \
    PIP_NO_CACHE_DIR=1

RUN if [ -f /etc/apt/sources.list.d/debian.sources ]; then \
      sed -i "s|http://deb.debian.org|http://${APT_MIRROR}|g; s|http://security.debian.org|http://${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources; \
    elif [ -f /etc/apt/sources.list ]; then \
      sed -i "s|http://deb.debian.org/debian|http://${APT_MIRROR}/debian|g; s|http://security.debian.org/debian-security|http://${APT_MIRROR}/debian-security|g" /etc/apt/sources.list; \
    fi \
    && apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv libgomp1 ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:${PATH}" \
    PIP_INDEX_URL=${PIP_INDEX_URL} \
    PIP_TRUSTED_HOST=${PIP_TRUSTED_HOST}

WORKDIR /app

COPY docker/requirements.docker.txt /tmp/requirements.docker.txt
RUN pip install --upgrade pip setuptools wheel \
    && pip install --index-url "${PYTORCH_CPU_INDEX_URL}" --trusted-host download.pytorch.org torch==2.6.0+cpu \
    && pip install --extra-index-url "${PYTORCH_CPU_INDEX_URL}" --trusted-host download.pytorch.org -r /tmp/requirements.docker.txt

COPY . /app
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist
COPY --from=frontend-builder /app/frontend/node_modules /app/frontend/node_modules

RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /app/vector_index /app/.cache/huggingface /app/.cache/sentence_transformers \
    && chown -R appuser:appuser /app /opt/venv

USER appuser
WORKDIR /app/frontend

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=5 \
  CMD curl -fsS http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "dist/server.cjs"]
