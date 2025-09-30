#!/bin/bash

################################################################################
# Script de Atualização Rápida
#
# Atualiza aplicação já deployada sem reconfigurar tudo
# Uso: bash scripts/update-remote.sh
################################################################################

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SSH_USER="claude"
SSH_HOST="212.85.2.24"
SSH_CONNECTION="${SSH_USER}@${SSH_HOST}"
SSH_PASSWORD="***REMOVED***"
REMOTE_PATH="/home/claude/apps/megasena-analyser"
APP_NAME="megasena-analyser"

echo -e "${BLUE}🔄 Atualizando aplicação...${NC}\n"

# Build local
echo -e "${YELLOW}1. Build local...${NC}"
bun run lint || exit 1
bun run build || exit 1
echo -e "${GREEN}✅ Build concluído${NC}\n"

# Transferir arquivos
echo -e "${YELLOW}2. Transferindo arquivos...${NC}"
sshpass -p "${SSH_PASSWORD}" rsync -avz --progress \
    -e "ssh -o StrictHostKeyChecking=no" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.next' \
    --exclude 'db/*.db' \
    --exclude '*.log' \
    --exclude '.env.*' \
    --exclude 'tests' \
    --exclude '___OLD_SITE' \
    --delete \
    ./ ${SSH_CONNECTION}:${REMOTE_PATH}/

echo -e "${GREEN}✅ Arquivos transferidos${NC}\n"

# Atualizar no servidor
echo -e "${YELLOW}3. Atualizando no servidor...${NC}"
sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no ${SSH_CONNECTION} << 'ENDSSH'
source ~/.nvm/nvm.sh
cd /home/claude/apps/megasena-analyser

# Instalar dependências
if command -v bun &> /dev/null; then
    bun install --production
else
    npm ci --production
fi

# Build
if command -v bun &> /dev/null; then
    bun run build
else
    npm run build
fi

# Reiniciar PM2
pm2 reload megasena-analyser --update-env

# Aguardar estabilização
sleep 2

# Verificar status
pm2 status megasena-analyser
ENDSSH

echo -e "\n${GREEN}✅ Atualização concluída!${NC}\n"
echo "Ver logs: sshpass -p '${SSH_PASSWORD}' ssh ${SSH_CONNECTION} 'pm2 logs megasena-analyser'"
