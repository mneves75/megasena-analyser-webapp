# 🔐 Instalação Manual de Chave SSH - PASSO A PASSO

**Status:** ✅ Chave SSH gerada
**Próximo:** Copiar para o servidor

---

## ✅ Já Concluído

1. ✅ Chave SSH Ed25519 gerada em `~/.ssh/id_megasena_vps`
2. ✅ Permissões configuradas corretamente
3. ✅ Config SSH criado em `~/.ssh/config`

---

## 🚀 Próximo Passo: Copiar Chave para o Servidor

Execute **UM** dos comandos abaixo no seu terminal:

### Opção 1: Usando ssh-copy-id (Recomendado)

```bash
ssh-copy-id -i ~/.ssh/id_megasena_vps.pub claude@212.85.2.24
```

**Digite a senha quando solicitado** (senha do servidor VPS)

---

### Opção 2: Método Manual (Se opção 1 falhar)

```bash
cat ~/.ssh/id_megasena_vps.pub | ssh claude@212.85.2.24 \
  "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo 'Chave instalada!'"
```

**Digite a senha quando solicitado** (senha do servidor VPS)

---

### Opção 3: Via Script Assistido

```bash
bash scripts/install-ssh-key.sh
```

**Digite a senha quando solicitado** (senha do servidor VPS)

---

## ✅ Validar Instalação

Depois de executar **um** dos comandos acima, teste a conexão **SEM SENHA**:

```bash
# Teste 1: Usando o alias
ssh megasena-vps "echo 'SSH key funcionando!'"

# Teste 2: Usando o caminho completo
ssh -i ~/.ssh/id_megasena_vps claude@212.85.2.24 "echo 'SSH key funcionando!'"
```

**Resultado esperado:**
- ✅ Exibe "SSH key funcionando!" SEM pedir senha
- ❌ Se pedir senha, algo deu errado

---

## 🔧 Troubleshooting

### Erro: "Permission denied (publickey,password)"

**Causa:** Senha incorreta ou chave não foi copiada

**Solução:**
```bash
# Verificar se você tem acesso com senha
ssh claude@212.85.2.24 "echo 'Acesso OK'"

# Se não funcionar, a senha pode ter mudado
```

### Erro: "Too many authentication failures"

**Causa:** Muitas chaves SSH na pasta ~/.ssh

**Solução:**
```bash
# Usar apenas a chave específica
ssh -o IdentitiesOnly=yes -i ~/.ssh/id_megasena_vps claude@212.85.2.24
```

### Erro: "WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED"

**Causa:** Chave do servidor mudou (normal se servidor foi reinstalado)

**Solução:**
```bash
ssh-keygen -R 212.85.2.24
```

---

## 📋 Checklist Pós-Instalação

Depois que a chave funcionar SEM senha, me avise para eu:

- [ ] Atualizar `scripts/deploy.sh` (remover senha)
- [ ] Limpar senhas da documentação
- [ ] Atualizar `.gitignore`
- [ ] Testar deploy completo
- [ ] Criar documentação de segurança

---

## 🔒 Informações da Chave

**Localização:**
- Chave privada: `~/.ssh/id_megasena_vps` (NUNCA compartilhar)
- Chave pública: `~/.ssh/id_megasena_vps.pub` (seguro compartilhar)
- Config SSH: `~/.ssh/config`

**Fingerprint:**
```
SHA256:OwfEGIYXRYTB6BYqO7qb7fWEx77HN0AWH0xp9cSqLu4
```

**Chave Pública (para referência):**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIExa/ukHDYpIGEW099Ayg68F1hwf0KaBuDBO0S6p13sx megasena-deploy@MacBook-Pro-de-Marcus.local
```

---

## ⏭️ Depois de Instalar

**Me avise quando conseguir conectar SEM senha** executando:

```bash
ssh megasena-vps "echo 'Funcionou!'"
```

Daí eu continuo com:
1. Atualização do script de deploy
2. Limpeza das senhas dos docs
3. Teste completo

---

**Aguardando sua confirmação!** 🎯
