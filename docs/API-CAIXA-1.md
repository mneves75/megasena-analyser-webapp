## API CAIXA

- No final da página dos resultados de cada tipo de jogo (megasena, lotofácil...) a Caixa disponibiliza um arquivo com o resultado de todos os jogos: Exemplos: loterias.caixa.gov.br/wps/portal/loterias/landing/megasena e loterias.caixa.gov.br/wps/portal/loterias/landing/lotofacil. Você pode fazer uma carga inicial destes arquivos para a sua base de dados, e ir atualizando a base usando a API da resposta ou ainda fazendo carga diferencial dos tais arquivos.

# php - Como posso pegar os resultados das loterias? - Stack Overflow em Português

Esta pergunta mostra esforço de pesquisa; é útil e clara

15

Save this question.

[](/posts/47597/timeline)

Exibir atividade dessa publicação

Pesquisei por API's da lotérica para pegar os resultados dos concursos, infelizmente não consegui achar nenhuma.

A resposta do `@fpg1503` consegue ler apenas o resultado do jogo atual, gostaria de saber se é possível pegar os resultados dos jogos anteriores também.

- [php](/questions/tagged/php "mostrar perguntas com a tag 'php'")
- [javascript](/questions/tagged/javascript "mostrar perguntas com a tag 'javascript'")
- [jquery](/questions/tagged/jquery "mostrar perguntas com a tag 'jquery'")
- [api](/questions/tagged/api "mostrar perguntas com a tag 'api'")

[Compartilhar](/q/47597 "permalink curto para esta pergunta")

Compartilhe um link para esta pergunta

Copiar link[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/ "The current license for this post: CC BY-SA 3.0")

[Melhore esta pergunta](/posts/47597/edit)

Seguir

Siga esta pergunta para receber notificações

[editada 25/01/2016 às 16:41](/posts/47597/revisions "mostrar todas as edições desta publicação")

Gabriel Rodrigues[Gabriel Rodrigues](/users/17658/gabriel-rodrigues)

perguntada 20/01/2015 às 15:02

[

![Gabriel Rodrigues's user avatar](https://i.sstatic.net/fRGsA.jpg?s=64)

](/users/17658/gabriel-rodrigues)

[Gabriel Rodrigues](/users/17658/gabriel-rodrigues)Gabriel Rodrigues

16,2mil1616 medalhas de ouro6363 medalhas de prata124124 medalhas de bronze

5

[Adicione um comentário](# "Use comentários para pedir mais informações ou sugerir melhorias. Evite responder perguntas em comentários.")  | [](# "ver todos os comentários desta publicação")

## 3 Respostas 3

Ordenado por: [Restaurar predefinição](/questions/47597/como-posso-pegar-os-resultados-das-loterias?answertab=scoredesc#tab-top)

Maior pontuação (predefinição) Data de modificação (mais recente primeiro) Data de criação (mais antiga primeiro)

Esta resposta é útil

15

Save this answer.

+25

Esta resposta recebeu gratificações valendo 25 reputações por Comunidade

[](/posts/116727/timeline)

Exibir atividade dessa publicação

Um exemplo usando php-curl para obter o resultado do jogo mais recente da Mega-Sena, diretamente do site oficial.

O script obtém os dados do site oficial onde é necessário ativar o cookie. Por isso é necessário setar `CURLOPT_COOKIESESSION`, `CURLOPT_COOKIEFILE` e `CURLOPT_COOKIEJAR`, sem os quais, o token que redireciona não carrega a página.

O parâmetro `CURLOPT_FOLLOWLOCATION` precisa estar como `true` para que permita o redirecionamento.

O Parâmetro `CURLOPT_RETURNTRANSFER` como `true` para que o resultado não seja despachado diretamente no browser, podendo assim, manipular a string recebida.

```php
$c = curl_init();
$cookie_file = __DIR__.DIRECTORY_SEPARATOR.'megasena.txt';
curl_setopt_array($c, array(
    CURLOPT_URL => 'http://www.loterias.caixa.gov.br/wps/portal/loterias/landing/megasena',
    CURLOPT_REFERER => 'http://www.loterias.caixa.gov.br',
    CURLOPT_USERAGENT => 'Foo Spider',
    CURLOPT_HEADER => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CONNECTTIMEOUT => 6,
    CURLOPT_TIMEOUT => 6,
    CURLOPT_MAXREDIRS => 1,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_COOKIESESSION => true,
    CURLOPT_COOKIEFILE => $cookie_file,
    CURLOPT_COOKIEJAR => $cookie_file
));

try {
    $content = curl_exec($c);
    $data = curl_getinfo($c);
    $data['content'] = $content;
    unset($content);
    $data['errno'] = curl_errno($c);
    $data['errmsg'] = curl_error($c);
    if ((int)$data['errno'] !== 0 || (int)$data['http_code'] !== 200) {
        echo 'error number: '.$data['errno'];
        echo 'error message: '.$data['errmsg'];
        echo 'http status: '.$data['http_code'];
        //print_r($data);
        exit;
    }
} catch (HttpException $ex) {
    print_r($ex); exit;
}

curl_close($c);

$doc = new DOMDocument();
@$doc->loadHTML($data['content']);
unset($data);
$tags = $doc->getElementsByTagName('ul');
$data = null;
foreach ($tags as $tag) {
    if ($tag->getAttribute('class') == 'numbers mega-sena') {
        $data = trim($tag->textContent);
        break;
    }
}
$arr = str_split($data, 2);
print_r($arr);
```

O resultado do jogo está num elemento `<ul>` cuja `class` é `numbers mega-sena`.

A lógica é apenas extrair o que interessa, iterando o objeto `$tags` até encontrar o alvo.

O resultado final será somente os números. Exemplo:

```undefined
304247505558
```

Utilizei o str_split() para separar cada dezena num array, o que retorna isso:

```csharp
Array
(
    [0] => 30
    [1] => 42
    [2] => 47
    [3] => 50
    [4] => 55
    [5] => 58
)
```

Nota: Os números do jogo são do Concurso 1795 (02/03/2016).

Para obter os resultados de jogos anteriores, siga a lógica sugerida no comentário do [@Caffé](https://pt.stackoverflow.com/users/14584/caff%C3%A9).

> No final da página dos resultados de cada tipo de jogo (megasena, lotofácil...) a Caixa disponibiliza um arquivo com o resultado de todos os jogos: Exemplos: loterias.caixa.gov.br/wps/portal/loterias/landing/megasena e loterias.caixa.gov.br/wps/portal/loterias/landing/lotofacil. Você pode fazer uma carga inicial destes arquivos para a sua base de dados, e ir atualizando a base usando a API da resposta ou ainda fazendo carga diferencial dos tais arquivos. – Caffé 2/03 às 16:26

Esteja ciente de que o site oficial não fornece, pelo menos desconheço, uma forma adequada de obter os resultados dos jogos.

Isso é o máximo que se pode fazer. Uma gambiarra.

Caso queira extrair outros dados, por exemplo, o número do concurso, valor do prêmio, etc, apenas leia o código HTML gerado pela página alvo. Então crie rotinas para abstrair os dados que deseja, tal como o exemplo demonstra a abstração do número sorteado do jogo.

Saliento que o script é um exemplo com finalidade didática. O trecho com `try/catch` tal como o trecho que identifica retorno de erro e o resultado final, implemente conforme for conveniente para o seu caso.

Importante estar ciente que uma mudança nos códigos da página dos resultados pode afetar o funcionamento. Portanto deve manter-se sempre atento a quaisquer mudanças na página de onde obtém os dados.

Para outros jogos como a Loto fácil, siga a mesma lógica do exemplo.

[Compartilhar](/a/116727 "permalink curto para esta resposta")

Compartilhe um link para esta resposta

Copiar link[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/ "The current license for this post: CC BY-SA 3.0")

[Melhore esta resposta](/posts/116727/edit)

Seguir

Siga esta resposta para receber notificações

[editada 13/04/2017 às 12:59](/posts/116727/revisions "mostrar todas as edições desta publicação")

[

![Comunidade's user avatar](https://www.gravatar.com/avatar/a007be5a61f6aa8f3e85ae2fc18dd66e?s=64&d=identicon&r=PG)

](/users/-1/comunidade)

[Comunidade](/users/-1/comunidade)Bot

1

respondida 5/03/2016 às 19:08

[

![Daniel Omine's user avatar](https://i.sstatic.net/eQXr7.jpg?s=64)

](/users/4793/daniel-omine)

[Daniel Omine](/users/4793/daniel-omine)Daniel Omine

20,1mil11 medalhas de ouro3636 medalhas de prata6767 medalhas de bronze

[Adicione um comentário](# "Use comentários para pedir mais informações ou sugerir melhorias. Evite comentários como “+1” ou “obrigado”.")  | [](# "ver todos os comentários desta publicação")

Esta resposta é útil

14

Save this answer.

[](/posts/47605/timeline)

Exibir atividade dessa publicação

**EDIT (29/08/2016): Esta API foi tirada do ar**

Como mencionado pelo [Fernando](https://pt.stackoverflow.com/users/2998/fernando) uma API para ver o resultado das lotéricas pode ser vista [aqui](http://developers.agenciaideias.com.br/loterias/loteriafederal/json).

Basta fazer um `GET` para `http://developers.agenciaideias.com.br/loterias/loteriafederal/json` e parsear o JSON.

# PHP

## Se `allow_url_fopen` estiver ativo

```bash
$json = json_decode(file_get_contents('http://developers.agenciaideias.com.br/loterias/loteriafederal/json'));
```

## Se não estiver

```bash
$curlSession = curl_init();
curl_setopt($curlSession, CURLOPT_URL, 'http://developers.agenciaideias.com.br/loterias/loteriafederal/json');
curl_setopt($curlSession, CURLOPT_BINARYTRANSFER, true);
curl_setopt($curlSession, CURLOPT_RETURNTRANSFER, true);

$json = json_decode(curl_exec($curlSession));
curl_close($curlSession);
```

# jQuery com Ajax

```javascript
$.ajax({
  url: "http://developers.agenciaideias.com.br/loterias/loteriafederal/json",
  dataType: "text",
  success: function (data) {
    var json = $.parseJSON(data);
  },
});
```

[Compartilhar](/a/47605 "permalink curto para esta resposta")

Compartilhe um link para esta resposta

Copiar link[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/ "The current license for this post: CC BY-SA 3.0")

[Melhore esta resposta](/posts/47605/edit)

Seguir

Siga esta resposta para receber notificações

[editada 13/04/2017 às 12:59](/posts/47605/revisions "mostrar todas as edições desta publicação")

[

![Comunidade's user avatar](https://www.gravatar.com/avatar/a007be5a61f6aa8f3e85ae2fc18dd66e?s=64&d=identicon&r=PG)

](/users/-1/comunidade)

[Comunidade](/users/-1/comunidade)Bot

1

respondida 20/01/2015 às 15:43

[

![fpg1503's user avatar](https://www.gravatar.com/avatar/4d9cba345c724ca98dc17a9ea8a7e0c6?s=64&d=identicon&r=PG)

](/users/3907/fpg1503)

[fpg1503](/users/3907/fpg1503)fpg1503

1.25699 medalhas de prata2222 medalhas de bronze

2

[Adicione um comentário](# "Use comentários para pedir mais informações ou sugerir melhorias. Evite comentários como “+1” ou “obrigado”.")  | [](# "ver todos os comentários desta publicação")

Esta resposta é útil

9

Save this answer.

[](/posts/545186/timeline)

Exibir atividade dessa publicação

É possivel obter qualquer resultado de qualquer modalidade de loteria na forma de um JSON, acessando uma simples URL.

Basta acessar diretamente as segintes URLs e será obtido o respectivo resultado do concurso mais recente:

[https://servicebus2.caixa.gov.br/portaldeloterias/api/quina](https://servicebus2.caixa.gov.br/portaldeloterias/api/quina)  
[https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena](https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena)  
[https://servicebus2.caixa.gov.br/portaldeloterias/api/duplasena](https://servicebus2.caixa.gov.br/portaldeloterias/api/duplasena)  
[https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil](https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil)  
[https://servicebus2.caixa.gov.br/portaldeloterias/api/lotomania](https://servicebus2.caixa.gov.br/portaldeloterias/api/lotomania)  
[https://servicebus2.caixa.gov.br/portaldeloterias/api/diadesorte](https://servicebus2.caixa.gov.br/portaldeloterias/api/diadesorte)  
[https://servicebus2.caixa.gov.br/portaldeloterias/api/timemania](https://servicebus2.caixa.gov.br/portaldeloterias/api/timemania)  
[https://servicebus2.caixa.gov.br/portaldeloterias/api/federal](https://servicebus2.caixa.gov.br/portaldeloterias/api/federal)  
[https://servicebus2.caixa.gov.br/portaldeloterias/api/loteca](https://servicebus2.caixa.gov.br/portaldeloterias/api/loteca)  
[https://servicebus2.caixa.gov.br/portaldeloterias/api/supersete](https://servicebus2.caixa.gov.br/portaldeloterias/api/supersete)

Nesse esquema, o JSON do resultado de um determinado concurso poderá ser obtido adicionando-se o número do sorteio desejado ao final da respectiva URL.

P.ex., para se obter o resultado do concurso 1234 da quina, basta um GET em

[https://servicebus2.caixa.gov.br/portaldeloterias/api/quina/1234](https://servicebus2.caixa.gov.br/portaldeloterias/api/quina/1234)

[Compartilhar](/a/545186 "permalink curto para esta resposta")

Compartilhe um link para esta resposta

Copiar link[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/ "The current license for this post: CC BY-SA 4.0")

[Melhore esta resposta](/posts/545186/edit)

Seguir

Siga esta resposta para receber notificações

[editada 11/03/2022 às 23:13](/posts/545186/revisions "mostrar todas as edições desta publicação")

respondida 11/03/2022 às 2:41

[

![Eudy's user avatar](https://www.gravatar.com/avatar/31de939e751c9a266c3218edb7165f1d?s=64&d=identicon&r=PG&f=y&so-version=2)

](/users/158120/eudy)

[Eudy](/users/158120/eudy)Eudy

16811 medalhas de prata55 medalhas de bronze

3

[Adicione um comentário](# "Use comentários para pedir mais informações ou sugerir melhorias. Evite comentários como “+1” ou “obrigado”.")  | [](# "ver todos os comentários desta publicação")

Start asking to get answers

Find the answer to your question by asking.

[Ask question](/questions/ask)

Explore related questions

- [php](/questions/tagged/php "mostrar perguntas com a tag 'php'")
- [javascript](/questions/tagged/javascript "mostrar perguntas com a tag 'javascript'")
- [jquery](/questions/tagged/jquery "mostrar perguntas com a tag 'jquery'")
- [api](/questions/tagged/api "mostrar perguntas com a tag 'api'")

See similar questions with these tags.

## Embedded Content

---

Fonte: https://pt.stackoverflow.com/questions/47597/como-posso-pegar-os-resultados-das-loterias
