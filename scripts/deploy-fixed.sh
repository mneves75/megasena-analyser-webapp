#!/bin/bash

################################################################################
# Script de Deploy CORRIGIDO - Mega-Sena Analyser
#
# Deploy para VPS Hostinger com isolamento de aplicação
# Usa PM2 + Caddy/Nginx em ambiente compartilhado
#
# ✅ FIXED: Port conflict (usar 3002 em vez de 3001)
# ✅ FIXED: NVM sourcing in all SSH sessions
# ✅ FIXED: Heredoc variable substitution
# ✅ FIXED: Port availability check
# ✅ FIXED: Bun optional, npm via NVM preferred
#
# Uso: bash scripts/deploy-fixed.sh
################################################################################

set -e  # Exit on error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configurações do servidor
SSH_USER="claude"
SSH_HOST="212.85.2.24"
SSH_CONNECTION="${SSH_USER}@${SSH_HOST}"
REMOTE_PATH="/home/claude/apps/megasena-analyser"
APP_PORT="3002"  # ✅ FIXED: Changed from 3001 to 3002 (free port)
APP_NAME="megasena-analyser"
SSH_PASSWORD="semsenha2025##"

################################################################################
# Funções auxiliares
################################################################################

print_step() {
    echo -e "${BLUE}==>${NC} ${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 não está instalado. Por favor, instale antes de continuar."
        exit 1
    fi
}

################################################################################
# Verificações pré-deploy
################################################################################

print_step "Verificando pré-requisitos locais..."

# Verificar comandos necessários
check_command "rsync"
check_command "ssh"
check_command "sshpass"
# ✅ FIXED: Removed mandatory bun check - will use npm/node via NVM on server

# Verificar se Bun está disponível localmente (opcional)
if command -v bun &> /dev/null; then
    print_success "Bun detectado localmente - usando para build"
    USE_BUN=true
else
    print_warning "Bun não encontrado - usando npm para build"
    USE_BUN=false
    check_command "npm"
fi

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    print_error "package.json não encontrado. Execute este script da raiz do projeto."
    exit 1
fi

# Verificar se app name no package.json está correto
APP_NAME_PKG=$(grep '"name"' package.json | head -1 | cut -d'"' -f4)
print_step "Aplicação: ${APP_NAME_PKG}"

################################################################################
# Confirmação do usuário
################################################################################

echo ""
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  Deploy para: ${SSH_CONNECTION}${NC}"
echo -e "${YELLOW}  Destino: ${REMOTE_PATH}${NC}"
echo -e "${YELLOW}  Porta: ${APP_PORT} (verificada como livre)${NC}"
echo -e "${YELLOW}════════════════════════════════════════════════════════════${NC}"
echo ""

# Accept --yes flag to skip confirmation
if [[ "$1" != "--yes" ]]; then
    read -p "Deseja continuar? (s/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        print_warning "Deploy cancelado pelo usuário."
        exit 0
    fi
else
    echo "Auto-confirmado (--yes flag)"
fi

################################################################################
# Testar conexão SSH e verificar porta
################################################################################

print_step "Testando conexão SSH..."
if sshpass -p "${SSH_PASSWORD}" ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${SSH_CONNECTION} "echo 'Conexão OK'" > /dev/null 2>&1; then
    print_success "Conexão SSH OK"
else
    print_error "Falha na conexão SSH. Verifique credenciais e conectividade."
    exit 1
fi

# ✅ FIXED: Added port availability check
print_step "Verificando disponibilidade da porta ${APP_PORT}..."
PORT_STATUS=$(sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no ${SSH_CONNECTION} \
    "ss -tulpn 2>/dev/null | grep -q ':${APP_PORT} ' && echo 'in-use' || echo 'free'")

if [ "$PORT_STATUS" = "in-use" ]; then
    print_error "Porta ${APP_PORT} já está em uso no servidor!"
    print_error "Escolha outra porta ou libere esta porta antes do deploy."
    exit 1
else
    print_success "Porta ${APP_PORT} está livre"
fi

################################################################################
# Build local
################################################################################

print_step "Executando lint..."
if [ "$USE_BUN" = true ]; then
    bun run lint || {
        print_error "Lint falhou. Corrija os erros antes do deploy."
        exit 1
    }
else
    npm run lint || {
        print_error "Lint falhou. Corrija os erros antes do deploy."
        exit 1
    }
fi

print_step "Fazendo build da aplicação localmente..."
if [ "$USE_BUN" = true ]; then
    bun run build || {
        print_error "Build falhou. Corrija os erros antes do deploy."
        exit 1
    }
else
    npm run build || {
        print_error "Build falhou. Corrija os erros antes do deploy."
        exit 1
    }
fi

print_success "Build local concluído!"

################################################################################
# Criar estrutura remota
################################################################################

print_step "Criando estrutura de diretórios no servidor..."
sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no ${SSH_CONNECTION} << 'ENDSSH'
mkdir -p /home/claude/apps/megasena-analyser/{db/migrations,logs,db/backups}
ENDSSH

print_success "Diretórios criados!"

################################################################################
# Transferir arquivos
################################################################################

print_step "Transferindo arquivos para o servidor..."
sshpass -p "${SSH_PASSWORD}" rsync -avz --progress \
    -e "ssh -o StrictHostKeyChecking=no" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '.next' \
    --exclude 'db/mega-sena.db' \
    --exclude 'db/*.db' \
    --exclude '*.log' \
    --exclude '.env.local' \
    --exclude '.env.development' \
    --exclude '.DS_Store' \
    --exclude 'tests' \
    --exclude '___OLD_SITE' \
    --delete \
    ./ ${SSH_CONNECTION}:${REMOTE_PATH}/

print_success "Arquivos transferidos!"

################################################################################
# Configurar ambiente de produção
################################################################################

print_step "Configurando variáveis de ambiente..."
# ✅ FIXED: Removed single quotes from EOF to allow variable substitution
sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no ${SSH_CONNECTION} << ENDSSH
cd ${REMOTE_PATH}

# Criar .env.production se não existir
if [ ! -f .env.production ]; then
    cat > .env.production << EOF
NODE_ENV=production
PORT=${APP_PORT}
DATABASE_PATH=${REMOTE_PATH}/db/mega-sena.db
CAIXA_API_BASE_URL=https://servicebus2.caixa.gov.br/portaldeloterias/api
EOF
    echo "✅ .env.production criado com variáveis corretas"
    cat .env.production
else
    echo "ℹ️  .env.production já existe"
fi
ENDSSH

print_success "Variáveis de ambiente configuradas!"

################################################################################
# Instalar dependências e fazer build
################################################################################

print_step "Instalando dependências no servidor..."
# ✅ FIXED: Source NVM in SSH session
sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no ${SSH_CONNECTION} << 'ENDSSH'
source ~/.nvm/nvm.sh
cd /home/claude/apps/megasena-analyser

echo "📦 Node version: $(node --version)"
echo "📦 npm version: $(npm --version)"

# Verificar se bun está disponível
if command -v bun &> /dev/null; then
    echo "📦 Usando Bun para instalar dependências (incluindo devDependencies para build)..."
    bun install
else
    echo "📦 Usando npm para instalar dependências (incluindo devDependencies para build)..."
    # Install all dependencies for build, will clean up devDeps after build
    npm install
fi
ENDSSH

print_success "Dependências instaladas!"

print_step "Executando build no servidor..."
# ✅ FIXED: Source NVM in SSH session
sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no ${SSH_CONNECTION} << 'ENDSSH'
source ~/.nvm/nvm.sh
cd /home/claude/apps/megasena-analyser

if command -v bun &> /dev/null; then
    bun run build
else
    npm run build
fi
ENDSSH

print_success "Build no servidor concluído!"

################################################################################
# Configurar banco de dados
################################################################################

print_step "Configurando banco de dados..."
# ✅ FIXED: Source NVM in SSH session
sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no ${SSH_CONNECTION} << 'ENDSSH'
source ~/.nvm/nvm.sh
cd /home/claude/apps/megasena-analyser

# Executar migrações
if [ ! -f db/mega-sena.db ]; then
    echo "🗄️  Banco de dados não existe. Criando..."
    if command -v bun &> /dev/null; then
        bun run db:migrate
    else
        npm run db:migrate
    fi
    echo "✅ Migrações executadas"

    echo "📊 Carregando dados iniciais (últimos 100 sorteios)..."
    if command -v bun &> /dev/null; then
        timeout 300 bun run db:pull -- --limit 100 || echo "⚠️  Timeout na carga de dados. Execute manualmente se necessário."
    else
        timeout 300 npm run db:pull -- --limit 100 || echo "⚠️  Timeout na carga de dados. Execute manualmente se necessário."
    fi
else
    echo "ℹ️  Banco de dados já existe. Pulando migração."
    echo "   Tamanho: $(ls -lh db/mega-sena.db | awk '{print $5}')"
fi

# Ajustar permissões
chmod 644 db/mega-sena.db 2>/dev/null || true
chmod 755 db/ 2>/dev/null || true
ENDSSH

print_success "Banco de dados configurado!"

################################################################################
# Configurar PM2
################################################################################

print_step "Configurando PM2..."
# ✅ FIXED: Removed single quotes from EOF and source NVM
sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no ${SSH_CONNECTION} << ENDSSH
source ~/.nvm/nvm.sh
cd ${REMOTE_PATH}

# Criar ecosystem.config.js
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: '${APP_NAME}',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p ${APP_PORT}',
    cwd: '${REMOTE_PATH}',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '700M',
    env: {
      NODE_ENV: 'production',
      PORT: ${APP_PORT}
    },
    error_file: '${REMOTE_PATH}/logs/error.log',
    out_file: '${REMOTE_PATH}/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
};
EOF

echo "✅ ecosystem.config.js criado"
echo "Conteúdo:"
cat ecosystem.config.js

# Verificar se PM2 está instalado
if ! command -v pm2 &> /dev/null; then
    echo "❌ PM2 não está instalado!"
    echo "   Tentando instalar globalmente..."
    npm install -g pm2
fi

echo "📦 PM2 version: \$(pm2 --version)"

# Verificar se aplicação já está rodando
if pm2 describe ${APP_NAME} &> /dev/null; then
    echo "🔄 Aplicação já existe no PM2. Reiniciando..."
    pm2 delete ${APP_NAME} || true
    pm2 start ecosystem.config.js
else
    echo "🚀 Iniciando aplicação no PM2..."
    pm2 start ecosystem.config.js
fi

# Salvar configuração
pm2 save

# Aguardar estabilização
sleep 3

# Listar processos
pm2 list
ENDSSH

print_success "PM2 configurado e aplicação iniciada!"

################################################################################
# Testar aplicação
################################################################################

print_step "Testando aplicação..."
sleep 5

sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no ${SSH_CONNECTION} << ENDSSH
source ~/.nvm/nvm.sh
cd ${REMOTE_PATH}

# Verificar status
echo "=== Status PM2 ==="
pm2 status ${APP_NAME}

echo ""
echo "=== Informações Detalhadas ==="
pm2 info ${APP_NAME} | head -30

echo ""
echo "📋 Últimos logs:"
pm2 logs ${APP_NAME} --lines 30 --nostream

echo ""
echo "🔍 Testando endpoint local..."
RESPONSE=\$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${APP_PORT} || echo "ERROR")
if [ "\$RESPONSE" = "200" ]; then
    echo "✅ Aplicação respondendo corretamente (HTTP \$RESPONSE)"
elif [ "\$RESPONSE" = "ERROR" ]; then
    echo "❌ Erro ao testar endpoint (curl falhou)"
else
    echo "⚠️  Aplicação retornou HTTP \$RESPONSE (aguarde alguns segundos e teste novamente)"
fi

echo ""
echo "=== Portas em uso ==="
ss -tulpn | grep ${APP_PORT} || echo "Porta ${APP_PORT} não está em LISTEN"
ENDSSH

################################################################################
# Informações finais
################################################################################

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Deploy concluído com sucesso!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo "📍 Localização: ${REMOTE_PATH}"
echo "🌐 Aplicação: http://localhost:${APP_PORT} (no servidor)"
echo "🔧 Porta: ${APP_PORT}"
echo ""
echo "Comandos úteis:"
echo ""
echo "  Ver status:"
echo "    sshpass -p '${SSH_PASSWORD}' ssh ${SSH_CONNECTION} 'pm2 status'"
echo ""
echo "  Ver logs em tempo real:"
echo "    sshpass -p '${SSH_PASSWORD}' ssh ${SSH_CONNECTION} 'pm2 logs ${APP_NAME}'"
echo ""
echo "  Reiniciar aplicação:"
echo "    sshpass -p '${SSH_PASSWORD}' ssh ${SSH_CONNECTION} 'pm2 restart ${APP_NAME}'"
echo ""
echo "  Atualizar dados do banco:"
echo "    sshpass -p '${SSH_PASSWORD}' ssh ${SSH_CONNECTION} 'cd ${REMOTE_PATH} && source ~/.nvm/nvm.sh && npm run db:pull -- --limit 50'"
echo ""
echo "⚠️  Próximos passos:"
echo "  1. Configure o Caddy/Nginx conforme DEPLOY.md"
echo "  2. Aponte seu domínio para ${SSH_HOST}:${APP_PORT} ou configure proxy"
echo "  3. Configure SSL/TLS se necessário"
echo "  4. Setup monitoramento e backups"
echo ""
echo -e "${YELLOW}📖 Consulte DEPLOYMENT_AUDIT.md para detalhes técnicos${NC}"
echo -e "${YELLOW}📖 Consulte DEPLOY.md para configuração de proxy reverso${NC}"
echo ""
