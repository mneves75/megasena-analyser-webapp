# Guia de Deploy - VPS Hostinger

Este guia detalha o processo completo de deploy da aplicação Mega-Sena Analyser em um VPS Hostinger compartilhado, garantindo isolamento de outros sites.

## Informações do Servidor

- **Host:** 212.85.2.24
- **Usuário SSH:** claude
- **Método:** Deploy via SSH com PM2 + Caddy (reverse proxy existente)
- **Porta da Aplicação (Next.js):** 3002
- **Porta da API Bun:** 3201

## Pré-requisitos no VPS

Antes do deploy, certifique-se de que o servidor possui:

1. **Node.js 20+** instalado (via NVM)
2. **Bun 1.2+** instalado (`~/.bun/bin/bun`)
3. **PM2** instalado globalmente
4. **Caddy** (reverse proxy) configurado e rodando
5. **Git** instalado

## Estrutura de Diretórios no VPS

A aplicação será instalada em:

```
/home/claude/apps/megasena-analyser/
├── .env.production          # Variáveis de ambiente
├── package.json
├── bun.lock
├── next.config.js
├── app/
├── components/
├── lib/
├── db/
│   ├── migrations/
│   └── mega-sena.db         # Banco de dados de produção
├── scripts/
└── .next/                   # Build de produção
```

## Processo de Deploy

### Opção 1: Deploy Automatizado (Recomendado)

Execute o script de deploy automático:

```bash
# Na sua máquina local
bash scripts/deploy.sh
```

O script irá:
1. Solicitar a senha SSH
2. Fazer build local da aplicação
3. Transferir arquivos via rsync
4. Instalar dependências no servidor
5. Executar migrações do banco
6. Iniciar/reiniciar a aplicação com PM2

### Opção 2: Deploy Manual

Se preferir controle manual, siga os passos abaixo.

## Passos Manuais Detalhados

### 1. Preparação Local

```bash
# Build da aplicação localmente
bun run lint
bun run build

# Verificar se o build foi bem-sucedido
ls -la .next/
```

### 2. Conexão SSH

```bash
ssh claude@212.85.2.24
# Digite a senha quando solicitado
```

### 3. Preparar Estrutura no Servidor

```bash
# No servidor VPS
cd /home/claude/apps
mkdir -p megasena-analyser
cd megasena-analyser
```

### 4. Transferir Arquivos (da máquina local)

```bash
# Volte para o terminal local
# Use rsync para transferir apenas arquivos necessários
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.next' \
  --exclude 'db/mega-sena.db' \
  --exclude '*.log' \
  ./ claude@212.85.2.24:/home/claude/apps/megasena-analyser/

# Senha será solicitada
```

### 5. Configurar Variáveis de Ambiente

```bash
# No servidor VPS
cd /home/claude/apps/megasena-analyser

# Criar arquivo .env.production (ajuste valores conforme necessário)
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3002
API_PORT=3201
DATABASE_PATH=/home/claude/apps/megasena-analyser/db/mega-sena.db
CAIXA_API_BASE_URL=https://servicebus2.caixa.gov.br/portaldeloterias/api
NEXT_PUBLIC_BASE_URL=https://conhecendotudo.online/megasena-analyzer
EOF
```

### 6. Instalar Dependências com Bun

```bash
# No servidor VPS
cd /home/claude/apps/megasena-analyser

~/.bun/bin/bun install
```

### 7. Build no Servidor

```bash
# No servidor VPS
cd /home/claude/apps/megasena-analyser

~/.bun/bin/bun run build
```

### 8. Preparar Banco de Dados

```bash
# No servidor VPS
cd /home/claude/apps/megasena-analyser

# Criar diretório do banco se não existir
mkdir -p db

# Executar migrações
~/.bun/bin/bun run db:migrate

# (Opcional) Carregar dados iniciais (100 últimos sorteios)
~/.bun/bin/bun run db:pull -- --limit 100

# Otimizar banco após ingestão inicial
~/.bun/bin/bun scripts/optimize-db.ts

# Verificar banco criado
ls -lh db/mega-sena.db
```

### 9. Configurar PM2 (Next.js + API Bun)

```bash
# No servidor VPS
cd /home/claude/apps/megasena-analyser

# Criar arquivo de configuração PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'megasena-analyser',
      cwd: '/home/claude/apps/megasena-analyser',
      script: '/home/claude/.bun/bin/bun',
      args: 'run start -- --port 3002',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        DATABASE_PATH: '/home/claude/apps/megasena-analyser/db/mega-sena.db',
        NEXT_PUBLIC_BASE_URL: 'https://conhecendotudo.online/megasena-analyzer'
      },
      error_file: '/home/claude/apps/megasena-analyser/logs/error.log',
      out_file: '/home/claude/apps/megasena-analyser/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    },
    {
      name: 'megasena-api',
      cwd: '/home/claude/apps/megasena-analyser',
      script: '/home/claude/.bun/bin/bun',
      args: 'run server.ts',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '250M',
      env: {
        NODE_ENV: 'production',
        API_PORT: 3201,
        DATABASE_PATH: '/home/claude/apps/megasena-analyser/db/mega-sena.db'
      },
      error_file: '/home/claude/apps/megasena-analyser/logs/api-error.log',
      out_file: '/home/claude/apps/megasena-analyser/logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
EOF

# Garantir diretório de logs
mkdir -p /home/claude/apps/megasena-analyser/logs

# Iniciar processos com PM2 (carregando NVM para ter node/pm2 no PATH)
source ~/.nvm/nvm.sh
pm2 start ecosystem.config.js

# Persistir lista de processos
pm2 save

# (Opcional) Configurar PM2 para iniciar no boot
pm2 startup
```

### 10. Verificar Aplicação Rodando

```bash
# No servidor VPS
pm2 status
pm2 logs megasena-analyser --lines 50
pm2 logs megasena-api --lines 50

# Testar localmente no servidor
curl http://localhost:3002
curl http://localhost:3201/api/dashboard

# Deve retornar HTML da aplicação
```

### 11. Atualizar Caddy (reverse proxy já em produção)

```bash
# No servidor VPS
sudo nano /etc/caddy/Caddyfile
```

Verifique se o bloco do domínio inclui o proxy abaixo (ajuste apenas se necessário):

```caddyfile
conhecendotudo.online, www.conhecendotudo.online {
    handle /megasena-analyzer* {
        reverse_proxy localhost:3002 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
            header_up X-Forwarded-For {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }

    handle /_next/* {
        reverse_proxy localhost:3002 {
            header_up Host {host}
            header_up X-Real-IP {remote_host}
        }
    }

    import security_headers
    import rate_limiting
    # ...demais diretivas já existentes...
}
```

Após salvar o arquivo, recarregue o Caddy:

```bash
sudo systemctl reload caddy
```

### 12. Certificados TLS

O Caddy gerencia automaticamente certificados Let's Encrypt para `conhecendotudo.online`. Basta garantir que o DNS aponte para `212.85.2.24` e o serviço esteja rodando. Use `sudo systemctl reload caddy` após qualquer alteração.

## Comandos Úteis

### Gerenciar Aplicação

```bash
# Ver status
pm2 status

# Ver logs em tempo real
pm2 logs megasena-analyser
pm2 logs megasena-api

# Reiniciar aplicação
pm2 restart megasena-analyser
pm2 restart megasena-api

# Parar aplicação
pm2 stop megasena-analyser
pm2 stop megasena-api

# Remover do PM2
pm2 delete megasena-analyser
pm2 delete megasena-api

# Ver informações detalhadas
pm2 info megasena-analyser
pm2 info megasena-api
```

### Atualizar Aplicação

```bash
# Na máquina local
bash scripts/deploy.sh

# OU manualmente no servidor:
cd /home/claude/apps/megasena-analyser
git pull origin main  # Se usar git
~/.bun/bin/bun install
~/.bun/bin/bun run build
pm2 restart megasena-analyser
pm2 restart megasena-api
```

### Backup do Banco de Dados

```bash
# No servidor VPS
cd /home/claude/apps/megasena-analyser

# Backup manual
cp db/mega-sena.db db/mega-sena.db.backup-$(date +%Y%m%d-%H%M%S)

# Backup automático (adicionar ao crontab)
echo "0 3 * * * cd /home/claude/apps/megasena-analyser && cp db/mega-sena.db db/backups/mega-sena.db.backup-\$(date +\%Y\%m\%d)" | crontab -
```

### Atualizar Dados do Banco

```bash
# No servidor VPS
cd /home/claude/apps/megasena-analyser

# Atualizar com últimos sorteios (incremental - recomendado)
~/.bun/bin/bun run db:pull -- --limit 50 --incremental

# Ou atualização completa (sobrescreve dados existentes)
~/.bun/bin/bun run db:pull -- --limit 50

# Otimizar banco após grandes atualizações
~/.bun/bin/bun scripts/optimize-db.ts

# Ver logs durante atualização (API Bun)
tail -f logs/api-out.log
```

## Troubleshooting

### Aplicação não inicia

```bash
# Verificar logs
pm2 logs megasena-analyser --lines 100
pm2 logs megasena-api --lines 100

# Verificar se a porta está em uso
ss -tulpn | grep -E '3002|3201'

# Testar build localmente
~/.bun/bin/bun run build
~/.bun/bin/bun run start -- --port 3002
```

### Erro de permissão no banco de dados

```bash
# Ajustar permissões
chmod 644 db/mega-sena.db
chmod 755 db/
```

### Caddy retorna erro 502/500

```bash
# Verificar se aplicação está rodando
pm2 status

# Verificar logs do Caddy
sudo tail -f /var/log/caddy/conhecendotudo.log

# Reiniciar aplicação
pm2 restart megasena-analyser
pm2 restart megasena-api
```

### Out of Memory

```bash
# Ajustar limite de memória no ecosystem.config.js
# Mudar max_memory_restart: '1G'

# Reiniciar
pm2 restart megasena-analyser
```

## Monitoramento

### Configurar PM2 Web Interface

```bash
pm2 install pm2-server-monit
pm2 web

# Acesse http://212.85.2.24:9615
```

### Health Check

```bash
# Script de health check
cat > /home/claude/apps/megasena-analyser/healthcheck.sh << 'EOF'
#!/bin/bash
NEXT=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002)
API=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3201/api/dashboard)

if [ "$NEXT" -ne 200 ] || [ "$API" -ne 200 ]; then
    echo "App down, restarting..."
    pm2 restart megasena-analyser
    pm2 restart megasena-api
fi
EOF

chmod +x healthcheck.sh

# Adicionar ao crontab (a cada 5 minutos)
echo "*/5 * * * * /home/claude/apps/megasena-analyser/healthcheck.sh" | crontab -
```

## Segurança

### Firewall

```bash
# Permitir apenas portas necessárias
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### Atualizar dependências

```bash
# Regularmente, verificar atualizações de segurança
cd /home/claude/apps/megasena-analyser
~/.bun/bin/bun update
~/.bun/bin/bun run build
pm2 restart megasena-analyser
pm2 restart megasena-api
```

## Rollback

Em caso de problema, fazer rollback:

```bash
# No servidor VPS
cd /home/claude/apps/megasena-analyser

# Restaurar backup do banco
cp db/mega-sena.db.backup-YYYYMMDD db/mega-sena.db

# Reverter para versão anterior (se usar git)
git checkout <commit-anterior>
~/.bun/bin/bun install
~/.bun/bin/bun run build
pm2 restart megasena-analyser
pm2 restart megasena-api
```

## Checklist de Deploy

- [ ] VPS acessível via SSH
- [ ] Node.js 20+ instalado
- [ ] Bun 1.1+ instalado
- [ ] PM2 instalado globalmente
- [ ] Nginx configurado
- [ ] Build local executado com sucesso
- [ ] Arquivos transferidos para o servidor
- [ ] .env.production configurado
- [ ] Dependências instaladas no servidor
- [ ] Build executado no servidor
- [ ] Banco de dados migrado
- [ ] Dados iniciais carregados
- [ ] PM2 configurado e aplicação iniciada
- [ ] Nginx configurado e testado
- [ ] SSL configurado (se aplicável)
- [ ] Logs funcionando corretamente
- [ ] Backup automático configurado
- [ ] Aplicação acessível via domínio

## Suporte

Para problemas específicos:
1. Verificar logs: `pm2 logs megasena-analyser`
2. Verificar status: `pm2 status`
3. Verificar Nginx: `sudo nginx -t`
4. Verificar portas: `netstat -tulpn`

---

**Última atualização:** 2025-09-30
