#!/bin/bash

################################################################################
# Script para Configurar Acesso Público - Mega-Sena Analyser
#
# Este script configura o Caddy para fazer proxy reverso da aplicação,
# tornando-a acessível publicamente via porta 8081
#
# Uso no servidor:
#   bash setup-public-access.sh
################################################################################

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  Configuração de Acesso Público${NC}"
echo -e "${BLUE}  Mega-Sena Analyser${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}1. Adicionando configuração ao Caddyfile...${NC}"

# Adicionar configuração ao Caddyfile
sudo tee -a /etc/caddy/Caddyfile > /dev/null << 'CADDY'

# Mega-Sena Analyser - Proxy para porta 3002
:8081 {
    reverse_proxy localhost:3002

    # CORS headers
    header {
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, POST, OPTIONS"
    }

    # Compressão
    encode gzip zstd

    # Logs
    log {
        output file /var/log/caddy/megasena-access.log
        format json
    }
}
CADDY

echo -e "${GREEN}✅ Configuração adicionada${NC}"

echo -e "\n${YELLOW}2. Validando configuração do Caddy...${NC}"
sudo caddy validate --config /etc/caddy/Caddyfile

echo -e "\n${YELLOW}3. Recarregando Caddy...${NC}"
sudo systemctl reload caddy

echo -e "\n${YELLOW}4. Aguardando 3 segundos...${NC}"
sleep 3

echo -e "\n${YELLOW}5. Verificando se porta 8081 está ativa...${NC}"
if ss -tulpn | grep -q :8081; then
    echo -e "${GREEN}✅ Porta 8081 está escutando${NC}"
else
    echo -e "${YELLOW}⚠️  Porta 8081 não aparece em ss. Isso é normal com Caddy.${NC}"
fi

echo -e "\n${YELLOW}6. Testando acesso local...${NC}"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081)
if [ "$RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Aplicação respondendo (HTTP $RESPONSE)${NC}"
else
    echo -e "${YELLOW}⚠️  HTTP Status: $RESPONSE${NC}"
fi

echo -e "\n${YELLOW}7. Liberando porta 8081 no firewall (se UFW estiver ativo)...${NC}"
if sudo ufw status 2>/dev/null | grep -q "Status: active"; then
    sudo ufw allow 8081/tcp
    echo -e "${GREEN}✅ Porta 8081 liberada no UFW${NC}"
else
    echo -e "${YELLOW}ℹ️  UFW não está ativo${NC}"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Configuração Concluída!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "🌐 ${BLUE}Acesse a aplicação em:${NC}"
echo -e "   ${YELLOW}http://212.85.2.24:8081${NC}"
echo ""
echo -e "📊 Comandos úteis:"
echo -e "   Ver logs do Caddy:"
echo -e "     ${YELLOW}sudo journalctl -u caddy -f${NC}"
echo ""
echo -e "   Ver logs da aplicação:"
echo -e "     ${YELLOW}sudo tail -f /var/log/caddy/megasena-access.log${NC}"
echo ""
echo -e "   Verificar status do Caddy:"
echo -e "     ${YELLOW}sudo systemctl status caddy${NC}"
echo ""
echo -e "   Testar localmente:"
echo -e "     ${YELLOW}curl http://localhost:8081${NC}"
echo ""
