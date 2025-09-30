# Guia de Deploy - VPS Hostinger

Este guia detalha o processo completo de deploy da aplicação Mega-Sena Analyser em um VPS Hostinger compartilhado, garantindo isolamento de outros sites.

## Informações do Servidor

- **Host:** 212.85.2.24
- **Usuário SSH:** claude
- **Método:** Deploy via SSH com PM2 + Nginx
- **Porta da Aplicação:** 3001 (ou próxima disponível)

## Pré-requisitos no VPS

Antes do deploy, certifique-se de que o servidor possui:

1. **Node.js 20+** instalado
2. **Bun 1.1+** instalado
3. **PM2** instalado globalmente
4. **Nginx** configurado e rodando
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

# Criar arquivo .env.production
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=3001
DATABASE_PATH=/home/claude/apps/megasena-analyser/db/mega-sena.db
CAIXA_API_BASE_URL=https://servicebus2.caixa.gov.br/portaldeloterias/api
EOF
```

### 6. Instalar Dependências

```bash
# No servidor VPS
cd /home/claude/apps/megasena-analyser

# Instalar com Bun (mais rápido)
bun install --production

# OU com npm/yarn se Bun não estiver disponível
# npm ci --production
```

### 7. Build no Servidor

```bash
# No servidor VPS
bun run build
```

### 8. Preparar Banco de Dados

```bash
# No servidor VPS
cd /home/claude/apps/megasena-analyser

# Criar diretório do banco se não existir
mkdir -p db

# Executar migrações
bun run db:migrate

# Carregar dados iniciais (100 últimos sorteios)
bun run db:pull -- --limit 100

# Verificar banco criado
ls -lh db/mega-sena.db
```

### 9. Configurar PM2

```bash
# No servidor VPS
cd /home/claude/apps/megasena-analyser

# Criar arquivo de configuração PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'megasena-analyser',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3001',
    cwd: '/home/claude/apps/megasena-analyser',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/home/claude/apps/megasena-analyser/logs/error.log',
    out_file: '/home/claude/apps/megasena-analyser/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF

# Criar diretório de logs
mkdir -p logs

# Iniciar aplicação com PM2
pm2 start ecosystem.config.js

# Salvar configuração PM2
pm2 save

# Configurar PM2 para iniciar no boot (se tiver permissão)
pm2 startup
```

### 10. Verificar Aplicação Rodando

```bash
# No servidor VPS
pm2 status
pm2 logs megasena-analyser --lines 50

# Testar localmente no servidor
curl http://localhost:3001

# Deve retornar HTML da aplicação
```

### 11. Configurar Nginx

```bash
# No servidor VPS
sudo nano /etc/nginx/sites-available/megasena-analyser.conf
```

Cole a configuração:

```nginx
# /etc/nginx/sites-available/megasena-analyser.conf

upstream megasena_backend {
    server 127.0.0.1:3001;
    keepalive 64;
}

server {
    listen 80;
    server_name megasena.seudominio.com.br;  # Altere para seu domínio

    # Logs isolados
    access_log /var/log/nginx/megasena-access.log;
    error_log /var/log/nginx/megasena-error.log;

    # Limite de tamanho de request
    client_max_body_size 10M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        proxy_pass http://megasena_backend;
        proxy_http_version 1.1;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    # Cache para assets estáticos
    location /_next/static {
        proxy_pass http://megasena_backend;
        proxy_cache_valid 60m;
        add_header Cache-Control "public, immutable";
    }

    # Cache para imagens
    location ~* \.(jpg|jpeg|png|gif|ico|svg|webp)$ {
        proxy_pass http://megasena_backend;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

Ativar o site:

```bash
# No servidor VPS
sudo ln -s /etc/nginx/sites-available/megasena-analyser.conf /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar Nginx
sudo systemctl reload nginx
```

### 12. Configurar SSL (Opcional mas Recomendado)

```bash
# No servidor VPS
sudo apt install certbot python3-certbot-nginx

# Obter certificado SSL
sudo certbot --nginx -d megasena.seudominio.com.br

# Certbot irá modificar automaticamente a configuração do Nginx
```

## Comandos Úteis

### Gerenciar Aplicação

```bash
# Ver status
pm2 status

# Ver logs em tempo real
pm2 logs megasena-analyser

# Reiniciar aplicação
pm2 restart megasena-analyser

# Parar aplicação
pm2 stop megasena-analyser

# Remover do PM2
pm2 delete megasena-analyser

# Ver informações detalhadas
pm2 info megasena-analyser
```

### Atualizar Aplicação

```bash
# Na máquina local
bash scripts/deploy.sh

# OU manualmente no servidor:
cd /home/claude/apps/megasena-analyser
git pull origin main  # Se usar git
bun install --production
bun run build
pm2 restart megasena-analyser
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

# Atualizar com últimos sorteios
bun run db:pull -- --limit 50

# Ver logs durante atualização
tail -f logs/out.log
```

## Troubleshooting

### Aplicação não inicia

```bash
# Verificar logs
pm2 logs megasena-analyser --lines 100

# Verificar se a porta está em uso
netstat -tulpn | grep 3001

# Testar build localmente
bun run build
bun run start
```

### Erro de permissão no banco de dados

```bash
# Ajustar permissões
chmod 644 db/mega-sena.db
chmod 755 db/
```

### Nginx retorna 502 Bad Gateway

```bash
# Verificar se aplicação está rodando
pm2 status

# Verificar logs do Nginx
sudo tail -f /var/log/nginx/megasena-error.log

# Reiniciar aplicação
pm2 restart megasena-analyser
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
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001)
if [ $RESPONSE -ne 200 ]; then
    echo "App down, restarting..."
    pm2 restart megasena-analyser
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
bun update
bun run build
pm2 restart megasena-analyser
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
bun install --production
bun run build
pm2 restart megasena-analyser
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
