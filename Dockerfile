# https://hub.docker.com/_/debian/tags?page=&page_size=&ordering=&name=bookworm
FROM debian:bookworm-20240408

# TODO: publish this on a Google Cloud registry so devs don't have to build it locally

ARG FOUNDRY_HASH=f625d0fa7c51e65b4bf1e8f7931cd1c6e2e285e9
ARG GITLEAKS_VERSION=8.18.2
ARG NODE_VERSION=20.12.2
ARG PNPM_VERSION=8.15.6
ARG SLITHER_VERSION=0.10.0
EXPOSE 13370

WORKDIR /home
RUN set -x && \
	apt-get update && \
	apt-get install --no-install-recommends -y strace && \
	apt-get install --no-install-recommends -y build-essential cargo git libusb-1.0-0 python3-pip wget xz-utils && \
	apt-get -y clean
RUN set -x && \
	touch "/home/.toolchain" && \
	mkdir -p /home/infinex-deployments /tmp/downloads /home/.local/share && \
	pip install --break-system-packages "slither-analyzer==$SLITHER_VERSION" && \
	# Gitleaks \
	wget --progress=dot:mega -O /tmp/downloads/gitleaks.tgz "https://github.com/gitleaks/gitleaks/releases/download/v$GITLEAKS_VERSION/gitleaks_${GITLEAKS_VERSION}_linux_arm64.tar.gz" && \
	tar x --no-same-owner -C /usr/bin -f /tmp/downloads/gitleaks.tgz gitleaks && \
	# Node.js et al \
	wget --progress=dot:mega -O /tmp/downloads/node.tar.xz "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-arm64.tar.xz" && \
	tar x --no-same-owner -C /usr -f /tmp/downloads/node.tar.xz --strip-components=1 --exclude '*.md' --exclude LICENSE && \
	npm install -g "pnpm@^$PNPM_VERSION" && \
	# https://github.com/pnpm/pnpm/issues/5803#issuecomment-1360641459 \
	mkdir -p /home/.config/pnpm && \
	echo store-dir=/home/.local/share/pnpm/store > /home/.config/pnpm/rc && \
	# Foundry \
	wget --progress=dot:mega -O /tmp/downloads/foundry.tgz "https://github.com/foundry-rs/foundry/releases/download/nightly-$FOUNDRY_HASH/foundry_nightly_linux_arm64.tar.gz" && \
	tar x --no-same-owner -C /usr/bin -f /tmp/downloads/foundry.tgz && \
	# Finish
	chown -R 1000:1000 /home && \
	rm -rf /tmp/downloads
