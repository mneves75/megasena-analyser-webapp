# Quick Start - Deploy Rápido

Guia express para fazer deploy no VPS Hostinger em poucos minutos.

## ⚡ Deploy em 3 Passos

### 1️⃣ Pré-requisitos

Certifique-se de ter no **servidor VPS**:
- Node.js 20+ instalado
- Bun 1.1+ instalado
- PM2 instalado: `npm install -g pm2`
- Nginx rodando
- Git instalado

### 2️⃣ Execute o Deploy

Na sua **máquina local**, dentro do diretório do projeto:

```bash
bash scripts/deploy.sh
```

O script irá:
- ✅ Fazer lint e build local
- ✅ Transferir arquivos via SSH (pedirá senha)
- ✅ Instalar dependências no servidor
- ✅ Configurar banco de dados SQLite
- ✅ Carregar dados iniciais da CAIXA
- ✅ Iniciar aplicação com PM2 na porta 3002 (Next.js) + 3201 (Bun API)

**Tempo estimado:** 5-10 minutos (dependendo da velocidade de transferência)

### 3️⃣ Configurar Nginx

**No servidor VPS:**

```bash
# Copiar configuração
sudo cp /home/claude/apps/megasena-analyser/nginx.conf.example /etc/nginx/sites-available/megasena-analyser

# Editar e ajustar o domínio
sudo nano /etc/nginx/sites-available/megasena-analyser
# Altere: server_name megasena.seudominio.com.br;

# Habilitar site
sudo ln -s /etc/nginx/sites-available/megasena-analyser /etc/nginx/sites-enabled/

# Testar e recarregar
sudo nginx -t
sudo systemctl reload nginx
```

### 4️⃣ Configurar SSL (Opcional mas Recomendado)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d megasena.seudominio.com.br
```

## 🎉 Pronto!

Acesse: `https://megasena.seudominio.com.br`

---

## 📋 Comandos Úteis

### Verificar Status
```bash
ssh claude@212.85.2.24 'pm2 status'
```

### Ver Logs
```bash
ssh claude@212.85.2.24 'pm2 logs megasena-analyser'
```

### Reiniciar App
```bash
ssh claude@212.85.2.24 'pm2 restart megasena-analyser'
```

### Atualizar Código (após modificações)
```bash
bash scripts/update-remote.sh
```

### Verificar Saúde da Aplicação
```bash
bash scripts/check-deployment.sh
```

### Atualizar Dados do Banco
```bash
ssh claude@212.85.2.24 'cd /home/claude/apps/megasena-analyser && bun run db:pull -- --limit 50'
```

### Otimizar Banco de Dados
```bash
# Recomendado após grandes atualizações de dados ou semanalmente
ssh claude@212.85.2.24 'cd /home/claude/apps/megasena-analyser && bun scripts/optimize-db.ts'
```

---

## 🐛 Troubleshooting Rápido

### Aplicação não inicia?
```bash
ssh claude@212.85.2.24
pm2 logs megasena-analyser --lines 50
```

### Porta 3002 ou 3201 em uso?
Altere a porta no `ecosystem.config.js` e no Nginx.

### Nginx retorna 502?
```bash
ssh claude@212.85.2.24 'pm2 restart megasena-analyser'
```

### Banco vazio?
```bash
ssh claude@212.85.2.24
cd /home/claude/apps/megasena-analyser
bun run db:migrate
bun run db:pull -- --limit 100
```

### Erro "disk I/O error" ou "SQLITE_IOERR_VNODE"?
Disco cheio (>95%). Verifique espaço e libere pelo menos 15-20%:
```bash
ssh claude@212.85.2.24
df -h  # Verificar espaço
du -sh /home/claude/apps/* | sort -h  # Ver uso por app
# Liberar espaço em disco (logs antigos, temp files, etc)
bun scripts/optimize-db.ts  # Otimizar banco após liberar espaço
```

---

## 📚 Documentação Completa

- **[DEPLOY.md](./DEPLOY.md)** - Guia completo de deploy
- **[README.md](./README.md)** - Documentação do projeto
- **[SETUP.md](./SETUP.md)** - Setup de desenvolvimento

---

## 🔧 Arquitetura

```
┌─────────────┐
│   Usuário   │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────┐
│    Nginx    │ (Porta 80/443)
│  Reverse    │
│    Proxy    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Next.js   │ (Porta 3002)
│  (via PM2)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   SQLite    │
│  Database   │
└─────────────┘
```

---

## 💡 Dicas

1. **Backup automático**: Configure cron para backup diário do banco
2. **Monitoramento**: Use `pm2 monit` para monitorar em tempo real
3. **Logs**: Logs ficam em `/home/claude/apps/megasena-analyser/logs/`
4. **Updates**: Use `update-remote.sh` para deploys rápidos
5. **Health Check**: Configure script de health check no cron

---

**Precisa de ajuda?** Consulte [DEPLOY.md](./DEPLOY.md) para instruções detalhadas.
