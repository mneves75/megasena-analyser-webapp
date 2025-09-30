# 🚀 Configuração Manual - Acesso via Path

## Status Atual
✅ Aplicação ATUALIZADA com basePath `/megasena-analyzer`
✅ Rodando na porta 3002
⏳ Aguardando configuração do Caddy

---

## ⚡ Configure em 3 Comandos (2 minutos)

Conecte ao servidor e execute:

```bash
ssh claude@212.85.2.24
# Senha: semsenha2025##
```

Depois execute estes 3 comandos:

### 1️⃣ Adicionar configuração ao Caddyfile

```bash
echo '
# Mega-Sena Analyzer
:80 {
    handle /megasena-analyzer* {
        reverse_proxy localhost:3002
    }

    handle {
        respond "Server running" 200
    }
}
' | sudo tee -a /etc/caddy/Caddyfile
```

### 2️⃣ Recarregar Caddy

```bash
sudo systemctl reload caddy
```

### 3️⃣ Testar

```bash
curl http://localhost/megasena-analyzer
```

Se retornar HTML, está funcionando! ✅

---

## 🌐 URL Final

Depois de configurar, acesse:

**http://212.85.2.24/megasena-analyzer**

### Todas as rotas:
- Homepage: `http://212.85.2.24/megasena-analyzer`
- Dashboard: `http://212.85.2.24/megasena-analyzer/dashboard`
- Estatísticas: `http://212.85.2.24/megasena-analyzer/dashboard/statistics`
- Gerador: `http://212.85.2.24/megasena-analyzer/dashboard/generator`

---

## 🔍 Troubleshooting

### Se der erro "address already in use"

Significa que a porta 80 já tem outra configuração. Nesse caso, use:

```bash
# Ver o Caddyfile atual
sudo cat /etc/caddy/Caddyfile
```

Procure por um bloco existente `:80 {` e adicione a configuração DENTRO dele:

```bash
sudo nano /etc/caddy/Caddyfile
```

Adicione dentro do bloco `:80 {`:

```caddyfile
    handle /megasena-analyzer* {
        reverse_proxy localhost:3002
    }
```

Salve (Ctrl+O, Enter, Ctrl+X) e reload:

```bash
sudo systemctl reload caddy
```

---

## 📊 Verificar Status

```bash
# Status do Caddy
sudo systemctl status caddy

# Logs do Caddy
sudo journalctl -u caddy -n 50

# Status da aplicação
pm2 status megasena-analyser

# Teste local
curl -v http://localhost/megasena-analyzer
```

---

## ✅ Checklist

- [ ] Conectou ao servidor via SSH
- [ ] Executou os 3 comandos acima
- [ ] Caddy recarregou sem erros
- [ ] `curl http://localhost/megasena-analyzer` retornou HTML
- [ ] Testou no navegador: `http://212.85.2.24/megasena-analyzer`

---

## 🎯 Alternativa: Usar Porta Diferente

Se você NÃO puder modificar a porta 80, pode usar outra porta (exemplo: 8081):

```bash
echo '
:8081 {
    reverse_proxy /megasena-analyzer* localhost:3002
}
' | sudo tee -a /etc/caddy/Caddyfile

sudo systemctl reload caddy
```

E acessar via: **http://212.85.2.24:8081/megasena-analyzer**

---

## 📝 Resumo do que foi feito

1. ✅ Aplicação configurada com `basePath: '/megasena-analyzer'`
2. ✅ Build feito com novo basePath
3. ✅ Deploy atualizado no servidor
4. ✅ PM2 recarregou a aplicação
5. ⏳ Falta apenas configurar o Caddy (os comandos acima)

---

**Dica:** Se tiver qualquer dúvida, me avise que eu ajudo! 🚀
