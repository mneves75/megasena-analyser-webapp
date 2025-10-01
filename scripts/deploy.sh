#!/bin/bash

################################################################################
# Deploy Script - Mega-Sena Analyser
#
# Automatiza o deploy completo para VPS Hostinger
#
# Uso: bash scripts/deploy.sh [options]
#
# Options:
#   --skip-build    Pula o build local (usa build existente)
#   --skip-rsync    Pula transferência de arquivos
#   --dry-run       Mostra comandos sem executar
#
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
SSH_KEY="$HOME/.ssh/id_megasena_vps"
SSH_ALIAS="megasena-vps"  # Alias configurado em ~/.ssh/config
REMOTE_DIR="/home/claude/apps/megasena-analyser"
APP_PORT="3002"
API_PORT="3201"

# Flags
SKIP_BUILD=false
SKIP_RSYNC=false
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --skip-rsync)
      SKIP_RSYNC=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo -e "${RED}Opção desconhecida: $1${NC}"
      echo "Uso: $0 [--skip-build] [--skip-rsync] [--dry-run]"
      exit 1
      ;;
  esac
done

################################################################################
# Funções auxiliares
################################################################################

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_step() {
    echo -e "${GREEN}▶ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

run_command() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} $1"
    else
        eval "$1"
    fi
}

ssh_command() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}[DRY-RUN SSH]${NC} $1"
    else
        # Usa o alias SSH configurado em ~/.ssh/config para conexão mais simples e segura
        ssh "$SSH_ALIAS" "$1"
    fi
}

################################################################################
# Verificações pré-deploy
################################################################################

print_header "🔍 Verificações Pré-Deploy"

# Verificar se estamos no diretório raiz do projeto
if [ ! -f "package.json" ]; then
    print_error "Erro: Execute este script da raiz do projeto"
    exit 1
fi
print_success "Diretório do projeto OK"

# Verificar se Bun está instalado
if ! command -v bun &> /dev/null; then
    print_error "Erro: Bun não está instalado"
    exit 1
fi
print_success "Bun instalado: $(bun --version)"

# Verificar se a chave SSH existe
if [ ! -f "$SSH_KEY" ]; then
    print_error "Chave SSH não encontrada: $SSH_KEY"
    print_error "Execute: ssh-keygen -t ed25519 -f $SSH_KEY -C 'megasena-deploy'"
    exit 1
fi
print_success "Chave SSH encontrada: $SSH_KEY"

# Verificar conectividade SSH
print_step "Testando conexão SSH..."
if ssh_command "echo 'Conexão SSH OK'" &> /dev/null; then
    print_success "Conexão SSH estabelecida"
else
    print_error "Falha ao conectar via SSH"
    exit 1
fi

################################################################################
# Build local
################################################################################

if [ "$SKIP_BUILD" = false ]; then
    print_header "🏗️  Build Local"

    print_step "Instalando dependências..."
    run_command "bun install"

    print_step "Executando linter..."
    run_command "bun run lint:fix || true"

    print_step "Executando build do Next.js..."
    run_command "bun run build"

    if [ -d ".next" ]; then
        print_success "Build concluído com sucesso"
    else
        print_error "Falha no build - diretório .next não foi criado"
        exit 1
    fi
else
    print_warning "Pulando build local (--skip-build)"
fi

################################################################################
# Transferência de arquivos
################################################################################

if [ "$SKIP_RSYNC" = false ]; then
    print_header "📦 Transferindo Arquivos"

    print_step "Sincronizando arquivos via rsync..."

    RSYNC_CMD="rsync -avz --progress \
        -e 'ssh -i $SSH_KEY' \
        --exclude 'node_modules' \
        --exclude '.git' \
        --exclude '.next' \
        --exclude 'db/*.db' \
        --exclude 'db/*.db-*' \
        --exclude '*.log' \
        --exclude 'logs/' \
        --exclude '.env.local' \
        --exclude '.DS_Store' \
        --exclude 'coverage' \
        --exclude '.turbo' \
        ./ $SSH_USER@$SSH_HOST:$REMOTE_DIR/"

    if [ "$DRY_RUN" = false ]; then
        eval $RSYNC_CMD
        print_success "Arquivos transferidos"
    else
        echo -e "${YELLOW}[DRY-RUN]${NC} $RSYNC_CMD"
    fi
else
    print_warning "Pulando transferência de arquivos (--skip-rsync)"
fi

################################################################################
# Instalação remota
################################################################################

print_header "🔧 Instalação Remota"

print_step "Instalando dependências no servidor..."
ssh_command "cd $REMOTE_DIR && ~/.bun/bin/bun install"
print_success "Dependências instaladas"

print_step "Executando build no servidor..."
ssh_command "cd $REMOTE_DIR && ~/.bun/bin/bun run build"
print_success "Build remoto concluído"

################################################################################
# Banco de dados
################################################################################

print_header "💾 Banco de Dados"

print_step "Criando diretório do banco de dados..."
ssh_command "mkdir -p $REMOTE_DIR/db"

print_step "Executando migrações..."
ssh_command "cd $REMOTE_DIR && ~/.bun/bin/bun run db:migrate"
print_success "Migrações executadas"

# Verificar se o banco já tem dados
print_step "Verificando banco de dados..."
DB_EXISTS=$(ssh_command "[ -f $REMOTE_DIR/db/mega-sena.db ] && echo 'yes' || echo 'no'")

if [ "$DB_EXISTS" = "no" ]; then
    print_warning "Banco de dados vazio. Deseja carregar dados iniciais?"
    read -p "Carregar últimos 100 sorteios? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_step "Carregando dados iniciais (últimos 100 sorteios)..."
        ssh_command "cd $REMOTE_DIR && ~/.bun/bin/bun run db:pull -- --limit 100"
        print_success "Dados carregados"
    fi
fi

################################################################################
# PM2 - Gerenciamento de processos
################################################################################

print_header "🚀 PM2 - Reiniciando Aplicação"

# Verificar se PM2 está instalado
print_step "Verificando PM2..."
PM2_CHECK=$(ssh_command "source ~/.nvm/nvm.sh && command -v pm2 && echo 'installed' || echo 'not-installed'")

if [[ $PM2_CHECK == *"installed"* ]]; then
    print_success "PM2 instalado"
else
    print_error "PM2 não está instalado no servidor"
    print_step "Instalando PM2 globalmente..."
    ssh_command "source ~/.nvm/nvm.sh && npm install -g pm2"
fi

# Criar diretório de logs
print_step "Criando diretório de logs..."
ssh_command "mkdir -p $REMOTE_DIR/logs"

# Verificar se processos já existem
print_step "Verificando processos PM2 existentes..."
PROCESSES=$(ssh_command "source ~/.nvm/nvm.sh && pm2 list | grep -E 'megasena-(analyser|api)' || echo 'none'")

if [[ $PROCESSES == *"megasena-analyser"* ]]; then
    print_step "Reiniciando processos existentes..."
    ssh_command "source ~/.nvm/nvm.sh && cd $REMOTE_DIR && pm2 restart ecosystem.config.js"
    print_success "Processos reiniciados"
else
    print_step "Iniciando novos processos..."
    ssh_command "source ~/.nvm/nvm.sh && cd $REMOTE_DIR && pm2 start ecosystem.config.js"
    print_success "Processos iniciados"
fi

# Salvar lista de processos
ssh_command "source ~/.nvm/nvm.sh && pm2 save"

################################################################################
# Verificações pós-deploy
################################################################################

print_header "✅ Verificações Pós-Deploy"

# Aguardar alguns segundos para aplicação iniciar
sleep 3

# Verificar status dos processos
print_step "Status dos processos PM2:"
ssh_command "source ~/.nvm/nvm.sh && pm2 status | grep -E 'megasena-(analyser|api)' || echo 'Nenhum processo encontrado'"

# Verificar se aplicação está respondendo
print_step "Testando endpoint local (porta $APP_PORT)..."
HTTP_CODE=$(ssh_command "curl -s -o /dev/null -w '%{http_code}' http://localhost:$APP_PORT")

if [ "$HTTP_CODE" = "200" ]; then
    print_success "Aplicação Next.js respondendo (HTTP $HTTP_CODE)"
else
    print_warning "Aplicação pode não estar funcionando corretamente (HTTP $HTTP_CODE)"
fi

# Testar API
print_step "Testando API Bun (porta $API_PORT)..."
API_CODE=$(ssh_command "curl -s -o /dev/null -w '%{http_code}' http://localhost:$API_PORT/api/dashboard" || echo "000")

if [ "$API_CODE" = "200" ]; then
    print_success "API Bun respondendo (HTTP $API_CODE)"
else
    print_warning "API pode não estar funcionando corretamente (HTTP $API_CODE)"
fi

################################################################################
# Logs e informações finais
################################################################################

print_header "📋 Informações Finais"

echo -e "${GREEN}Deploy concluído com sucesso!${NC}\n"

echo -e "${BLUE}Acessos:${NC}"
echo "  • Acesso direto: http://$SSH_HOST:$APP_PORT"
echo "  • Via Caddy (se configurado): https://conhecendotudo.online/megasena-analyzer"
echo ""

echo -e "${BLUE}Comandos úteis:${NC}"
echo "  • Ver logs:        ssh $SSH_USER@$SSH_HOST 'source ~/.nvm/nvm.sh && pm2 logs megasena-analyser'"
echo "  • Status PM2:      ssh $SSH_USER@$SSH_HOST 'source ~/.nvm/nvm.sh && pm2 status'"
echo "  • Reiniciar:       ssh $SSH_USER@$SSH_HOST 'source ~/.nvm/nvm.sh && pm2 restart megasena-analyser'"
echo "  • Atualizar dados: ssh $SSH_USER@$SSH_HOST 'cd $REMOTE_DIR && ~/.bun/bin/bun run db:pull'"
echo ""

echo -e "${BLUE}Logs ao vivo:${NC}"
ssh_command "source ~/.nvm/nvm.sh && pm2 logs megasena-analyser --lines 20"

print_header "🎉 Deploy Finalizado"

exit 0
