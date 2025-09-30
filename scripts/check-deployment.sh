#!/bin/bash

################################################################################
# Script de Verificação Pós-Deploy
#
# Verifica se a aplicação está rodando corretamente no servidor
# Uso: bash scripts/check-deployment.sh
################################################################################

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SSH_CONNECTION="claude@212.85.2.24"
APP_NAME="megasena-analyser"
APP_PORT="3001"

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Verificação de Deploy - Mega-Sena Analyser${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# Status do PM2
echo -e "${YELLOW}1. Status do PM2:${NC}"
ssh ${SSH_CONNECTION} "pm2 status ${APP_NAME}"
echo ""

# Uso de memória
echo -e "${YELLOW}2. Uso de Memória:${NC}"
ssh ${SSH_CONNECTION} "pm2 show ${APP_NAME} | grep -E 'memory|cpu'"
echo ""

# Verificar se aplicação responde
echo -e "${YELLOW}3. Teste de Endpoint:${NC}"
ssh ${SSH_CONNECTION} << 'ENDSSH'
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001)
echo "HTTP Status: $RESPONSE"
if [ "$RESPONSE" -eq "200" ]; then
    echo "✅ Aplicação respondendo corretamente"
else
    echo "❌ Aplicação não está respondendo (HTTP $RESPONSE)"
fi
ENDSSH
echo ""

# Últimos logs
echo -e "${YELLOW}4. Últimos Logs (20 linhas):${NC}"
ssh ${SSH_CONNECTION} "pm2 logs ${APP_NAME} --lines 20 --nostream"
echo ""

# Verificar banco de dados
echo -e "${YELLOW}5. Banco de Dados:${NC}"
ssh ${SSH_CONNECTION} << 'ENDSSH'
DB_PATH="/home/claude/apps/megasena-analyser/db/mega-sena.db"
if [ -f "$DB_PATH" ]; then
    DB_SIZE=$(ls -lh "$DB_PATH" | awk '{print $5}')
    echo "✅ Banco existe: $DB_SIZE"

    # Contar sorteios
    DRAWS_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM draws;" 2>/dev/null || echo "0")
    echo "📊 Total de sorteios: $DRAWS_COUNT"
else
    echo "❌ Banco de dados não encontrado!"
fi
ENDSSH
echo ""

# Verificar Nginx
echo -e "${YELLOW}6. Nginx (se configurado):${NC}"
ssh ${SSH_CONNECTION} << 'ENDSSH'
if [ -f "/etc/nginx/sites-available/megasena-analyser" ]; then
    echo "✅ Configuração do Nginx existe"
    if [ -L "/etc/nginx/sites-enabled/megasena-analyser" ]; then
        echo "✅ Site habilitado no Nginx"
    else
        echo "⚠️  Site não está habilitado (falta symlink)"
    fi
else
    echo "⚠️  Nginx ainda não configurado"
fi
ENDSSH
echo ""

# Uso de disco
echo -e "${YELLOW}7. Uso de Disco:${NC}"
ssh ${SSH_CONNECTION} "du -sh /home/claude/apps/megasena-analyser"
echo ""

# Uptime do processo
echo -e "${YELLOW}8. Uptime da Aplicação:${NC}"
ssh ${SSH_CONNECTION} "pm2 show ${APP_NAME} | grep uptime"
echo ""

echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Verificação concluída!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo "Para monitoramento em tempo real:"
echo "  ssh ${SSH_CONNECTION} 'pm2 monit'"
echo ""
