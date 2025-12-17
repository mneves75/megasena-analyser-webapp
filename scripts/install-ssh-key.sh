#!/bin/bash

################################################################################
# Script para Instalar Chave SSH no Servidor
#
# Este script copia a chave pública SSH para o servidor VPS de forma segura
#
# Uso: bash scripts/install-ssh-key.sh
################################################################################

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Instalação de Chave SSH no VPS${NC}\n"

# Configurações
SSH_KEY="$HOME/.ssh/id_megasena_vps.pub"
SSH_HOST="212.85.2.24"
SSH_USER="claude"

# Verificar se a chave existe
if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}[ERROR] Chave SSH não encontrada: $SSH_KEY${NC}"
    exit 1
fi

echo -e "${GREEN}[OK] Chave SSH encontrada${NC}"
echo -e "\nChave pública a ser instalada:"
echo -e "${YELLOW}$(cat $SSH_KEY)${NC}\n"

# Método 1: Tentar ssh-copy-id
echo -e "${GREEN}Tentando instalar com ssh-copy-id...${NC}"
echo -e "${YELLOW}Digite a senha SSH quando solicitado${NC}\n"

if command -v ssh-copy-id &> /dev/null; then
    ssh-copy-id -i "$SSH_KEY" "$SSH_USER@$SSH_HOST"
else
    echo -e "${YELLOW}[WARN] ssh-copy-id não disponível. Usando método manual...${NC}\n"

    # Método 2: Manual via SSH
    echo -e "${GREEN}Instalando chave manualmente...${NC}"
    echo -e "${YELLOW}Digite a senha SSH quando solicitado${NC}\n"

    cat "$SSH_KEY" | ssh "$SSH_USER@$SSH_HOST" \
        "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo 'Chave instalada com sucesso'"
fi

echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}[OK] Instalação concluída!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# Testar conexão
echo -e "${GREEN}Testando conexão sem senha...${NC}\n"

if ssh -i "${SSH_KEY%.pub}" -o BatchMode=yes "$SSH_USER@$SSH_HOST" "echo 'SSH key funcionando!'" 2>/dev/null; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}[OK] SUCESSO! Chave SSH está funcionando${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

    echo -e "${GREEN}Agora você pode conectar sem senha:${NC}"
    echo -e "  ${YELLOW}ssh megasena-vps${NC}"
    echo -e "  ${YELLOW}ssh -i ~/.ssh/id_megasena_vps claude@212.85.2.24${NC}\n"
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}[WARN] Chave instalada, mas teste de conexão falhou${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

    echo -e "${YELLOW}Teste manual:${NC}"
    echo -e "  ${YELLOW}ssh -i ~/.ssh/id_megasena_vps claude@212.85.2.24${NC}\n"
fi

exit 0
