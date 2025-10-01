# 🔐 Plano de Migração: Senha → Chaves SSH

**Objetivo:** Remover todas as senhas hardcoded e implementar autenticação segura via chaves SSH

**Status:** PLANEJAMENTO
**Data:** 01/10/2025
**Prioridade:** 🔴 CRÍTICA (Segurança)

---

## 📋 Análise da Situação Atual

### Arquivos com Senhas Hardcoded

| Arquivo | Localização | Tipo de Exposição | Risco |
|---------|-------------|-------------------|-------|
| `scripts/deploy.sh` | Linha 19 | `SSH_PASSWORD="***REMOVED***"` | 🔴 CRÍTICO |
| `docs/DEPLOY_VPS/DEPLOY.md` | Várias linhas | Exemplos com senha | 🟡 MÉDIO |
| `docs/DEPLOY_VPS/ACCESS_GUIDE.md` | Linha 38 | Senha em comentário | 🟡 MÉDIO |
| `docs/DEPLOY_VPS/DEPLOYMENT_SUCCESS.md` | Senha mencionada | Documentação | 🟢 BAIXO |
| `docs/DEPLOY_VPS/MANUAL_PATH_SETUP.md` | Comandos com senha | Exemplos | 🟡 MÉDIO |

### Riscos Identificados

1. **Exposição em Repositório Git** 🔴
   - Senhas commitadas no histórico
   - Visíveis em repositórios públicos/privados
   - Recuperáveis mesmo após remoção

2. **Exposição em Scripts** 🔴
   - Legíveis por qualquer usuário com acesso ao filesystem
   - Visíveis em processos rodando (`ps aux`)
   - Logs podem capturar senhas

3. **Compartilhamento Não Seguro** 🟡
   - Documentação com senhas pode ser compartilhada
   - Screenshots podem expor credenciais

---

## 🎯 Objetivos da Migração

### Curto Prazo (Hoje)
- ✅ Remover **todas** as senhas hardcoded
- ✅ Implementar autenticação SSH via chaves
- ✅ Atualizar documentação sem senhas
- ✅ Criar guia de configuração segura

### Médio Prazo (1 semana)
- ✅ Rotacionar senha SSH atual no servidor
- ✅ Desabilitar autenticação por senha no SSH (opcional)
- ✅ Configurar 2FA no servidor (opcional)

### Longo Prazo (1 mês)
- ✅ Implementar secret management (HashiCorp Vault, AWS Secrets Manager)
- ✅ Auditar todo histórico Git para senhas
- ✅ Configurar pre-commit hooks para detectar secrets

---

## 📐 Arquitetura da Solução

### Método Atual (❌ Inseguro)
```
┌─────────────┐                    ┌─────────────┐
│   Cliente   │ ─── senha ──────>  │   Servidor  │
│   (Local)   │    plaintext       │    (VPS)    │
└─────────────┘                    └─────────────┘
     ▲
     │ senha hardcoded
     │ em scripts/docs
```

### Método Novo (✅ Seguro)
```
┌─────────────┐                    ┌─────────────┐
│   Cliente   │ ─── SSH key ────>  │   Servidor  │
│   (Local)   │    criptografada   │    (VPS)    │
└─────────────┘                    └─────────────┘
     │
     ├─ ~/.ssh/id_ed25519 (privada)
     └─ Nunca commitada no Git

                                         │
                                         ├─ ~/.ssh/authorized_keys
                                         └─ Chave pública
```

---

## 🔧 Plano de Implementação Detalhado

### Fase 1: Preparação (15 minutos)

#### 1.1 Backup de Segurança
```bash
# Fazer backup dos arquivos atuais
cp scripts/deploy.sh scripts/deploy.sh.backup
cp -r docs/DEPLOY_VPS docs/DEPLOY_VPS.backup

# Criar snapshot da pasta .ssh (se existir)
tar -czf ~/.ssh-backup-$(date +%Y%m%d).tar.gz ~/.ssh/ 2>/dev/null || true
```

#### 1.2 Verificar Acesso Atual
```bash
# Testar se consegue conectar com senha
ssh claude@212.85.2.24 "echo 'Acesso OK'"

# Se falhar, PARE aqui e resolva antes de prosseguir
```

---

### Fase 2: Geração de Chaves SSH (5 minutos)

#### 2.1 Gerar Par de Chaves (Cliente)

**Opção A: Ed25519 (Recomendado - Mais Seguro e Rápido)**
```bash
ssh-keygen -t ed25519 \
  -f ~/.ssh/id_megasena_vps \
  -C "megasena-deploy@$(hostname)" \
  -N ""

# Saída:
# ~/.ssh/id_megasena_vps      (PRIVADA - NUNCA compartilhar)
# ~/.ssh/id_megasena_vps.pub  (PÚBLICA - seguro compartilhar)
```

**Opção B: RSA 4096 bits (Alternativa - Mais Compatível)**
```bash
ssh-keygen -t rsa -b 4096 \
  -f ~/.ssh/id_megasena_vps \
  -C "megasena-deploy@$(hostname)" \
  -N ""
```

#### 2.2 Configurar Permissões Corretas
```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_megasena_vps
chmod 644 ~/.ssh/id_megasena_vps.pub
```

#### 2.3 Criar Config SSH Local
```bash
cat >> ~/.ssh/config << 'EOF'

# Mega-Sena Analyser VPS
Host megasena-vps
    HostName 212.85.2.24
    User claude
    IdentityFile ~/.ssh/id_megasena_vps
    IdentitiesOnly yes
    AddKeysToAgent yes
    ForwardAgent no
EOF

chmod 600 ~/.ssh/config
```

---

### Fase 3: Instalação no Servidor (10 minutos)

#### 3.1 Copiar Chave Pública para o Servidor

**Método 1: ssh-copy-id (Mais Fácil)**
```bash
ssh-copy-id -i ~/.ssh/id_megasena_vps.pub claude@212.85.2.24
# Digite a senha uma última vez
```

**Método 2: Manual (se ssh-copy-id não estiver disponível)**
```bash
# Exibir chave pública
cat ~/.ssh/id_megasena_vps.pub

# Conectar ao servidor (com senha)
ssh claude@212.85.2.24

# No servidor:
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys

# Cole a chave pública aqui (Ctrl+Shift+V)
# Salve (Ctrl+O, Enter, Ctrl+X)

chmod 600 ~/.ssh/authorized_keys
exit
```

#### 3.2 Testar Acesso sem Senha
```bash
# Testar conexão com chave SSH
ssh -i ~/.ssh/id_megasena_vps claude@212.85.2.24 "echo 'SSH key funcionando!'"

# OU usando o alias do config
ssh megasena-vps "echo 'SSH key funcionando!'"

# ✅ Se funcionar, sucesso!
# ❌ Se pedir senha, verificar passos anteriores
```

---

### Fase 4: Atualizar Script de Deploy (15 minutos)

#### 4.1 Remover Senha do Script
```bash
# Editar scripts/deploy.sh
# REMOVER linha:
# SSH_PASSWORD="***REMOVED***"

# REMOVER todas referências a sshpass
# SUBSTITUIR chamadas SSH por versão com chave
```

#### 4.2 Novo scripts/deploy.sh (Seguro)
```bash
#!/bin/bash

# Configurações do servidor
SSH_USER="claude"
SSH_HOST="212.85.2.24"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_megasena_vps}"
REMOTE_DIR="/home/claude/apps/megasena-analyser"

# Função SSH sem senha
ssh_command() {
    ssh -i "$SSH_KEY" "$SSH_USER@$SSH_HOST" "$1"
}

# OU usar alias do config
ssh_command() {
    ssh megasena-vps "$1"
}

# Exemplo de uso:
ssh_command "cd $REMOTE_DIR && ~/.bun/bin/bun run build"
```

---

### Fase 5: Limpar Documentação (20 minutos)

#### 5.1 Atualizar docs/DEPLOY_VPS/DEPLOY.md
```markdown
# REMOVER todas menções a senhas

# SUBSTITUIR:
echo '***REMOVED***' | sudo -S comando

# POR:
sudo comando
```

#### 5.2 Criar Nova Documentação: SSH_SETUP.md
```markdown
# Configuração de Chaves SSH

## Gerar Chave
ssh-keygen -t ed25519 -f ~/.ssh/id_megasena_vps

## Instalar no Servidor
ssh-copy-id -i ~/.ssh/id_megasena_vps.pub claude@212.85.2.24

## Testar
ssh -i ~/.ssh/id_megasena_vps claude@212.85.2.24
```

#### 5.3 Arquivos a Atualizar
- [ ] `docs/DEPLOY_VPS/DEPLOY.md`
- [ ] `docs/DEPLOY_VPS/ACCESS_GUIDE.md`
- [ ] `docs/DEPLOY_VPS/MANUAL_PATH_SETUP.md`
- [ ] `docs/DEPLOY_VPS/DEPLOYMENT_SUCCESS.md`
- [ ] `scripts/deploy.sh`

---

### Fase 6: Segurança Adicional (30 minutos)

#### 6.1 Atualizar .gitignore
```bash
cat >> .gitignore << 'EOF'

# SSH Keys (NUNCA commitar!)
*.pem
*.key
*_rsa
*_ed25519
id_*
*.pub

# Secrets
.env.local
.env.production
secrets/
*.secret

# Backups com senhas
*.backup
*_backup_*
EOF
```

#### 6.2 Limpar Histórico Git (Opcional mas Recomendado)
```bash
# ATENÇÃO: Isso reescreve histórico! Use com cuidado!

# Instalar BFG Repo Cleaner
brew install bfg  # macOS
# OU baixar de: https://rtyley.github.io/bfg-repo-cleaner/

# Remover senhas do histórico
bfg --replace-text passwords.txt

# passwords.txt contém:
# ***REMOVED***==>***REMOVED***
```

#### 6.3 Configurar Pre-Commit Hook
```bash
# Instalar detect-secrets
pip install detect-secrets

# Criar hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
detect-secrets scan --baseline .secrets.baseline
if [ $? -ne 0 ]; then
    echo "❌ SECRETS DETECTADOS! Commit bloqueado."
    exit 1
fi
EOF

chmod +x .git/hooks/pre-commit
```

---

### Fase 7: Hardening do Servidor (Opcional - 30 minutos)

#### 7.1 Desabilitar Autenticação por Senha (SSH)
```bash
# No servidor (VPS)
sudo nano /etc/ssh/sshd_config

# Alterar:
PasswordAuthentication no
ChallengeResponseAuthentication no
UsePAM no

# Salvar e reiniciar SSH
sudo systemctl restart sshd
```

⚠️ **ATENÇÃO:** Só faça isso DEPOIS de confirmar que a chave SSH funciona!

#### 7.2 Configurar Fail2Ban
```bash
# No servidor
sudo apt install fail2ban -y

# Configurar
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local

# [sshd]
# enabled = true
# maxretry = 3
# bantime = 3600

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

#### 7.3 Rotacionar Senha Atual
```bash
# No servidor, mudar senha do usuário
passwd

# Nova senha forte (mínimo 16 caracteres)
# Armazenar em gerenciador de senhas (1Password, Bitwarden, etc.)
```

---

## 🧪 Plano de Testes

### Teste 1: SSH Key Funcionando
```bash
ssh -i ~/.ssh/id_megasena_vps claude@212.85.2.24 "echo 'OK'"
# ✅ Esperado: "OK" sem pedir senha
```

### Teste 2: Deploy Sem Senha
```bash
bash scripts/deploy.sh --dry-run
# ✅ Esperado: Nenhum prompt de senha
```

### Teste 3: Rsync Sem Senha
```bash
rsync -avz -e "ssh -i ~/.ssh/id_megasena_vps" \
  ./teste.txt claude@212.85.2.24:/tmp/
# ✅ Esperado: Arquivo transferido sem senha
```

### Teste 4: Git Não Contém Senhas
```bash
git log -p | grep -i "senha\|password" | wc -l
# ✅ Esperado: 0
```

### Teste 5: Pre-Commit Hook
```bash
# Criar arquivo com senha fake
echo "password=teste123" > test.txt
git add test.txt
git commit -m "test"
# ✅ Esperado: Commit bloqueado
```

---

## 📊 Checklist de Execução

### Pré-Requisitos
- [ ] Backup de scripts e documentação
- [ ] Acesso SSH atual funcional
- [ ] Git status limpo (sem mudanças não commitadas)

### Implementação
- [ ] Gerar chave SSH local (Ed25519)
- [ ] Configurar ~/.ssh/config
- [ ] Instalar chave pública no servidor
- [ ] Testar acesso sem senha
- [ ] Atualizar scripts/deploy.sh
- [ ] Remover senhas da documentação
- [ ] Criar SSH_SETUP.md
- [ ] Atualizar .gitignore
- [ ] Testar deploy completo

### Segurança Adicional (Opcional)
- [ ] Limpar histórico Git (BFG)
- [ ] Configurar pre-commit hook
- [ ] Desabilitar auth por senha no servidor
- [ ] Configurar Fail2Ban
- [ ] Rotacionar senha atual
- [ ] Configurar 2FA (Google Authenticator)

### Validação Final
- [ ] Deploy funciona sem senha
- [ ] Nenhuma senha em scripts
- [ ] Nenhuma senha em docs
- [ ] Git history limpo
- [ ] Pre-commit hook funcional
- [ ] Documentação atualizada

---

## 🚨 Plano de Rollback

Se algo der errado:

### Rollback Fase 1: Restaurar Scripts
```bash
cp scripts/deploy.sh.backup scripts/deploy.sh
cp -r docs/DEPLOY_VPS.backup/* docs/DEPLOY_VPS/
```

### Rollback Fase 2: Remover Chave SSH
```bash
# No servidor
ssh claude@212.85.2.24
nano ~/.ssh/authorized_keys
# Remover a linha da chave adicionada
```

### Rollback Fase 3: Restaurar SSH Config
```bash
# Se desabilitou senha no servidor
sudo nano /etc/ssh/sshd_config
# PasswordAuthentication yes
sudo systemctl restart sshd
```

---

## 📝 Cronograma Estimado

| Fase | Tempo | Complexidade |
|------|-------|--------------|
| 1. Preparação | 15 min | 🟢 Fácil |
| 2. Gerar chaves | 5 min | 🟢 Fácil |
| 3. Instalar no servidor | 10 min | 🟢 Fácil |
| 4. Atualizar script | 15 min | 🟡 Médio |
| 5. Limpar docs | 20 min | 🟡 Médio |
| 6. Segurança adicional | 30 min | 🟡 Médio |
| 7. Hardening servidor | 30 min | 🔴 Avançado |
| **Total** | **2h 5min** | |

---

## 🎓 Recursos de Aprendizado

### Documentação Oficial
- **OpenSSH:** https://www.openssh.com/manual.html
- **GitHub SSH Guide:** https://docs.github.com/en/authentication/connecting-to-github-with-ssh
- **DigitalOcean Tutorial:** https://www.digitalocean.com/community/tutorials/how-to-configure-ssh-key-based-authentication-on-a-linux-server

### Ferramentas Recomendadas
- **ssh-keygen:** Geração de chaves
- **ssh-copy-id:** Instalação de chaves
- **BFG Repo Cleaner:** Limpar histórico Git
- **detect-secrets:** Pre-commit hook para secrets
- **1Password / Bitwarden:** Gerenciadores de senha

### Boas Práticas
1. **Nunca commite chaves privadas**
2. **Use passphrases em chaves SSH** (opcional mas recomendado)
3. **Rotacione chaves a cada 1-2 anos**
4. **Use diferentes chaves para diferentes servidores**
5. **Faça backup de chaves privadas em local seguro**

---

## ✅ Próximos Passos

1. **Revisar este plano** com o time
2. **Escolher janela de manutenção** (baixo tráfego)
3. **Executar Fases 1-5** (essenciais)
4. **Testar completamente**
5. **Documentar alterações** no CHANGELOG.md
6. **Considerar Fases 6-7** (segurança avançada)

---

## 🆘 Suporte

Se encontrar problemas:

1. **SSH não conecta com chave:**
   ```bash
   ssh -vvv -i ~/.ssh/id_megasena_vps claude@212.85.2.24
   # Ver logs detalhados
   ```

2. **Permissões incorretas:**
   ```bash
   chmod 700 ~/.ssh
   chmod 600 ~/.ssh/id_megasena_vps
   chmod 644 ~/.ssh/id_megasena_vps.pub
   ```

3. **Chave não aceita no servidor:**
   ```bash
   # No servidor, verificar logs
   sudo tail -f /var/log/auth.log | grep sshd
   ```

---

**Criado em:** 01/10/2025
**Atualizado em:** 01/10/2025
**Versão:** 1.0
**Status:** PLANEJAMENTO COMPLETO ✅

---

**Próximo Arquivo:** `docs/SECURITY_SSH_IMPLEMENTATION.md` (criado após execução)
