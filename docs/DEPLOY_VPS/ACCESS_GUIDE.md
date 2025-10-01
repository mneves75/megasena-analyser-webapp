# 🌐 Guia de Acesso à Aplicação

## Status Atual

- **Servidor:** 212.85.2.24
- **Aplicação:** Rodando na porta 3002
- **Status:** ✅ Online e funcionando
- **Proxy Reverso:** Caddy rodando nas portas 80/443

---

## 📍 Opções de Acesso

### Opção 1: Acesso Direto via Porta (Mais Rápido)

**Teste primeiro se a porta 3002 está acessível:**

```bash
curl -v http://212.85.2.24:3002
```

Se funcionar, você pode acessar diretamente via:

**URL:** `http://212.85.2.24:3002`

⚠️ **Nota:** Alguns firewalls podem bloquear portas customizadas. Se não funcionar, use a Opção 2.

---

### Opção 2: Configurar Caddy (Recomendado para Produção)

O Caddy já está rodando no servidor. Você precisa adicionar uma configuração para fazer proxy para a porta 3002.

#### Passo 1: Conectar ao Servidor

```bash
ssh claude@212.85.2.24
# Senha: semsenha2025##
```

#### Passo 2: Editar Caddyfile

```bash
sudo nano /etc/caddy/Caddyfile
```

#### Passo 3: Adicionar Configuração

**Opção A: Usar IP diretamente (sem domínio)**
```caddyfile
# No final do arquivo, adicione:

:8081 {
    reverse_proxy localhost:3002
}
```

**Opção B: Usar domínio/subdomínio (se tiver)**
```caddyfile
# No final do arquivo, adicione:

megasena.seudominio.com {
    reverse_proxy localhost:3002
}

# Ou usar um subdomínio:
analyser.seudominio.com {
    reverse_proxy localhost:3002
}
```

#### Passo 4: Recarregar Caddy

```bash
sudo systemctl reload caddy
```

#### Passo 5: Verificar

```bash
# Se usou porta 8081:
curl http://212.85.2.24:8081

# Se usou domínio:
curl http://megasena.seudominio.com
```

---

### Opção 3: Usar Nginx (Alternativa)

Se preferir usar Nginx em vez do Caddy:

#### Criar Configuração

```bash
sudo nano /etc/nginx/sites-available/megasena
```

Cole:
```nginx
server {
    listen 8081;
    server_name 212.85.2.24;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Ativar e Recarregar

```bash
sudo ln -s /etc/nginx/sites-available/megasena /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🎯 Acesso Recomendado

### Para Teste Rápido (Agora)

1. **Teste acesso direto:**
   ```bash
   # Da sua máquina local:
   curl http://212.85.2.24:3002
   ```

2. **Se funcionar, acesse no navegador:**
   ```
   http://212.85.2.24:3002
   ```

### Para Produção (Recomendado)

1. **Configure Caddy** na porta 8081 (seguindo Opção 2A acima)
2. **Acesse via:** `http://212.85.2.24:8081`

Ou, se tiver um domínio:

1. **Configure DNS** apontando para 212.85.2.24
2. **Configure Caddy** com seu domínio (Opção 2B)
3. **Caddy configurará SSL automaticamente!** ✅
4. **Acesse via:** `https://megasena.seudominio.com`

---

## 🔒 Configurar SSL (Automático com Caddy)

Se você usar um domínio na configuração do Caddy (Opção 2B), o SSL será configurado **automaticamente**!

O Caddy irá:
1. Obter certificado Let's Encrypt
2. Configurar HTTPS
3. Redirecionar HTTP → HTTPS
4. Renovar certificados automaticamente

---

## 🔥 Quick Start (Método Mais Rápido)

Execute no servidor:

```bash
ssh claude@212.85.2.24 << 'EOF'
# Adicionar proxy na porta 8081
echo '
:8081 {
    reverse_proxy localhost:3002
}
' | sudo tee -a /etc/caddy/Caddyfile

# Recarregar Caddy
sudo systemctl reload caddy

# Testar
sleep 2
curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:8081
EOF
```

Depois acesse: **`http://212.85.2.24:8081`**

---

## 📊 Portas Disponíveis no Servidor

| Porta | Status | Uso Atual |
|-------|--------|-----------|
| 80 | EM USO | Caddy (HTTP) |
| 443 | EM USO | Caddy (HTTPS) |
| 3001 | EM USO | Outra aplicação Next.js |
| **3002** | **EM USO** | **Mega-Sena Analyser** ✅ |
| 3010 | EM USO | Outra aplicação |
| 8080 | EM USO | Serviço desconhecido |
| **8081** | **LIVRE** | **Recomendado para proxy** |
| 8082 | LIVRE | Disponível |

---

## 🧪 Teste de Conectividade

Da sua máquina local, execute:

```bash
# Teste 1: Ping do servidor
ping 212.85.2.24

# Teste 2: Porta 3002 acessível?
nc -zv 212.85.2.24 3002

# Teste 3: HTTP funciona?
curl -v http://212.85.2.24:3002

# Teste 4: Porta 8081 (se configurou Caddy)
curl -v http://212.85.2.24:8081
```

---

## ⚠️ Troubleshooting

### Erro: "Connection refused"

**Causa:** Firewall bloqueando a porta

**Solução:**
```bash
ssh claude@212.85.2.24
sudo ufw allow 8081/tcp
sudo ufw reload
```

### Erro: "503 Service Unavailable"

**Causa:** Aplicação não está rodando

**Solução:**
```bash
ssh claude@212.85.2.24
pm2 restart megasena-analyser
```

### Erro: "Connection timeout"

**Causa:** Caddy/Nginx não configurado corretamente

**Solução:** Verifique os logs:
```bash
ssh claude@212.85.2.24
sudo journalctl -u caddy -n 50
```

---

## 📱 Resumo Executivo

### Acesso Mais Simples (SEM domínio)

1. Execute este comando para configurar proxy na porta 8081:
```bash
ssh claude@212.85.2.24 "echo ':8081 { reverse_proxy localhost:3002 }' | sudo tee -a /etc/caddy/Caddyfile && sudo systemctl reload caddy"
```

2. Acesse: **`http://212.85.2.24:8081`**

### Acesso Profissional (COM domínio)

1. Aponte DNS do seu domínio para `212.85.2.24`
2. Configure Caddy com seu domínio
3. Acesse via HTTPS (automático!) ✅

---

**Precisa de ajuda?** Siga o passo a passo acima ou me avise qual método você prefere!
