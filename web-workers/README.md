# Web Workers

Um Web Worker é uma thread de execução JavaScript separada na mesma origem que permite executar tarefas pesadas em segundo plano sem bloquear a interface do usuário (UI). Ele é criado usando `Worker()` ou `WorkerConstructor()`, e comunica-se com a thread principal por meio de mensagens enviadas através de eventos `postMessage` e `onmessage`.

Os Web Workers são úteis para operações assíncronas, como processamento de dados, manipulação de arquivos grandes, ou qualquer outra tarefa que possa ser realizada fora da thread principal para melhorar o desempenho e a experiência do usuário.

• **Web Workers Dedicados**: São Web Workers que têm acesso apenas aos recursos disponíveis no navegador e não podem acessar diretamente o DOM (Document Object Model) da página. Eles são úteis para tarefas que não precisam interagir diretamente com a UI, como processamento de dados, cálculos complexos, etc. Para criar um Web Worker dedicado, você usa o construtor `Worker()` passando o caminho para um script JavaScript que será executado pelo Web Worker.

```jsx
const myWorker = new Worker("worker.js");
```

• **Workers Compartilhados**: São uma extensão dos Web Workers que permitem a comunicação direta entre diferentes instâncias de Workers e entre Workers e a thread principal. Isso facilita o compartilhamento de recursos e a coordenação entre múltiplas tarefas. Workers compartilhados usam o mesmo código fonte e podem comunicar-se entre si usando `importScripts()`. Eles são úteis quando você precisa de uma lógica centralizada que pode ser acessada por vários Workers ou pela thread principal.

Workers compartilhados podem ser úteis em aplicações que costumeiramente são utilizadas em diversas abas e portanto precisam se comunicar em tempo real entre elas.

```jsx
// No main thread
const sharedWorker = new SharedWorker("shared-worker.js");

// Dentro de um Worker
self.importScripts("shared-worker.js");
```

### Envio de Dados entre Web Workers e Web Pages

Os dados enviados entre Web Workers e a página da web **são copiados em vez de serem passados por referência** devido à natureza assíncrona dos Web Workers. Isso ocorre para garantir que cada thread (o principal e os Web Workers) tenha sua própria cópia dos dados manipulados, evitando conflitos de acesso simultâneo aos mesmos dados. Além disso, essa abordagem permite que os Web Workers operem independentemente do estado da página principal, facilitando a programação paralela e melhorando o desempenho geral da aplicação.
<br/>

<aside>
📌 Web Workers não permitem o envio direto de funções JavaScript para serem executadas em um thread separado por motivos de segurança e isolamento. No entanto, você pode contornar essa limitação enviando uma string que representa a função desejada para o Web Worker. Essa string deve ser compilada de volta para uma função dentro do contexto do Web Worker. Bibliotecas como `worker-loader` ou `workerize` podem ajudar nesse processo, permitindo que você compile e execute código assíncrono de forma mais fácil e segura
</aside>
