#!/bin/bash

################################################################################
# Script para Configurar Acesso via Path - Mega-Sena Analyser
#
# Configura a aplicação para ser acessível em:
# http://212.85.2.24/megasena-analyzer
#
# Uso no servidor:
#   bash setup-path-access.sh
################################################################################

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  Configuração de Acesso via Path${NC}"
echo -e "${BLUE}  URL: /megasena-analyzer${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}1. Verificando Caddyfile atual...${NC}"
if [ -f /etc/caddy/Caddyfile ]; then
    echo -e "${GREEN}✅ Caddyfile encontrado${NC}"
else
    echo -e "${RED}❌ Caddyfile não encontrado!${NC}"
    exit 1
fi

echo -e "\n${YELLOW}2. Criando backup do Caddyfile...${NC}"
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup-$(date +%Y%m%d-%H%M%S)
echo -e "${GREEN}✅ Backup criado${NC}"

echo -e "\n${YELLOW}3. Adicionando configuração para /megasena-analyzer...${NC}"

# Verificar se já existe configuração para porta 80
if grep -q "^:80 {" /etc/caddy/Caddyfile; then
    echo -e "${YELLOW}ℹ️  Porta 80 já configurada. Adicionando rota dentro do bloco existente...${NC}"

    # Adicionar dentro do bloco :80 existente
    sudo sed -i '/^:80 {/a\    # Mega-Sena Analyzer\n    handle /megasena-analyzer* {\n        reverse_proxy localhost:3002\n    }' /etc/caddy/Caddyfile
else
    echo -e "${YELLOW}ℹ️  Criando novo bloco para porta 80...${NC}"

    # Adicionar novo bloco para porta 80
    sudo tee -a /etc/caddy/Caddyfile > /dev/null << 'CADDY'

# Porta 80 com path routing
:80 {
    # Mega-Sena Analyzer
    handle /megasena-analyzer* {
        reverse_proxy localhost:3002
    }

    # Resposta padrão para root
    handle {
        respond "Server is running" 200
    }

    # CORS headers
    header {
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, POST, OPTIONS"
    }

    # Compressão
    encode gzip zstd

    # Logs
    log {
        output file /var/log/caddy/access.log
        format json
    }
}
CADDY
fi

echo -e "${GREEN}✅ Configuração adicionada${NC}"

echo -e "\n${YELLOW}4. Validando configuração do Caddy...${NC}"
if sudo caddy validate --config /etc/caddy/Caddyfile; then
    echo -e "${GREEN}✅ Configuração válida${NC}"
else
    echo -e "${RED}❌ Erro na configuração! Restaurando backup...${NC}"
    sudo cp /etc/caddy/Caddyfile.backup-* /etc/caddy/Caddyfile
    exit 1
fi

echo -e "\n${YELLOW}5. Recarregando Caddy...${NC}"
sudo systemctl reload caddy
sleep 2

echo -e "\n${YELLOW}6. Verificando status do Caddy...${NC}"
if sudo systemctl is-active --quiet caddy; then
    echo -e "${GREEN}✅ Caddy está rodando${NC}"
else
    echo -e "${RED}❌ Caddy não está rodando!${NC}"
    echo -e "${YELLOW}Tentando iniciar...${NC}"
    sudo systemctl start caddy
fi

echo -e "\n${YELLOW}7. Testando acesso local...${NC}"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/megasena-analyzer 2>/dev/null || echo "000")
if [ "$RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Aplicação respondendo (HTTP $RESPONSE)${NC}"
elif [ "$RESPONSE" = "301" ] || [ "$RESPONSE" = "302" ]; then
    echo -e "${GREEN}✅ Aplicação respondendo com redirect (HTTP $RESPONSE)${NC}"
else
    echo -e "${YELLOW}⚠️  HTTP Status: $RESPONSE${NC}"
    echo -e "${YELLOW}Aguarde alguns segundos e teste manualmente${NC}"
fi

echo -e "\n${YELLOW}8. Verificando firewall (porta 80)...${NC}"
if sudo ufw status 2>/dev/null | grep -q "Status: active"; then
    if sudo ufw status | grep -q "80/tcp"; then
        echo -e "${GREEN}✅ Porta 80 já está liberada${NC}"
    else
        sudo ufw allow 80/tcp
        echo -e "${GREEN}✅ Porta 80 liberada no UFW${NC}"
    fi
else
    echo -e "${YELLOW}ℹ️  UFW não está ativo${NC}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Configuração Concluída!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "🌐 ${BLUE}Acesse a aplicação em:${NC}"
echo -e "   ${YELLOW}http://212.85.2.24/megasena-analyzer${NC}"
echo ""
echo -e "📋 ${BLUE}Outras URLs:${NC}"
echo -e "   Homepage:    ${YELLOW}http://212.85.2.24/megasena-analyzer${NC}"
echo -e "   Dashboard:   ${YELLOW}http://212.85.2.24/megasena-analyzer/dashboard${NC}"
echo -e "   Estatísticas: ${YELLOW}http://212.85.2.24/megasena-analyzer/dashboard/statistics${NC}"
echo -e "   Gerador:     ${YELLOW}http://212.85.2.24/megasena-analyzer/dashboard/generator${NC}"
echo ""
echo -e "📊 ${BLUE}Comandos úteis:${NC}"
echo -e "   Testar localmente:"
echo -e "     ${YELLOW}curl http://localhost/megasena-analyzer${NC}"
echo ""
echo -e "   Ver logs do Caddy:"
echo -e "     ${YELLOW}sudo journalctl -u caddy -f${NC}"
echo ""
echo -e "   Ver configuração:"
echo -e "     ${YELLOW}sudo cat /etc/caddy/Caddyfile${NC}"
echo ""
echo -e "   Restaurar backup (se necessário):"
echo -e "     ${YELLOW}sudo cp /etc/caddy/Caddyfile.backup-* /etc/caddy/Caddyfile${NC}"
echo -e "     ${YELLOW}sudo systemctl reload caddy${NC}"
echo ""
