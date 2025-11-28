// Armazena todos os IDs de intervalo ativos para que possamos limpá-los (parar o timer)
const timersAtivos = {};

// Declare esta variável ANTES de qualquer função que a use.
let contadorDeConcluidas = parseInt(sessionStorage.getItem('contadorDeConcluidas')) || 0;

// Função para atualizar o contador de tarefas concluídas
function atualizarContador() {
  document.getElementById("contadorTarefas").textContent = `Tarefas Concluídas: ${contadorDeConcluidas}`;
  // Armazena a contagem de tarefas no sessionStorage
  sessionStorage.setItem('contadorDeConcluidas', contadorDeConcluidas);
}

// --- FUNÇÕES AUXILIARES ---

// Função para gerar uma rotação aleatória para os post-its
function getRandomRotation() {
  return Math.floor(Math.random() * 9) - 4;
}

// Função para formatar a data
function formatarData(data) {
  if (!data) return "";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

// Função que faz o cálculo e formatação do tempo restante
function calcularTempoRestante(dataAlvo) {
  const dataInformada = new Date(dataAlvo + "T00:00:00").getTime(); // Assume meia-noite
  const dataAgora = new Date().getTime();
  let tempoFaltante = dataInformada - dataAgora;

  if (tempoFaltante < 0) {
    return {
      mensagem: "EXPIRADO!",
      expirado: true,
    };
  }

  const msPorSegundo = 1000;
  const msPorMinuto = 60 * msPorSegundo;
  const msPorHora = 60 * msPorMinuto;
  const msPorDia = 24 * msPorHora;

  const dias = Math.floor(tempoFaltante / msPorDia);
  const horas = Math.floor((tempoFaltante % msPorDia) / msPorHora);
  const minutos = Math.floor((tempoFaltante % msPorHora) / msPorMinuto);
  const segundos = Math.floor((tempoFaltante % msPorMinuto) / msPorSegundo);

  return {
    mensagem: `Faltam: ${dias}d ${horas}h ${minutos}m ${segundos}s`,
    expirado: false,
  };
}

// Função que inicia e atualiza o timer
function iniciarContagem(postItElement, data) {
  const postId = postItElement.getAttribute("data-post-id");

  // Limpa o timer anterior se existir
  if (timersAtivos[postId]) {
    clearInterval(timersAtivos[postId]);
  }

  const timerElement = postItElement.querySelector(".post-it-timer");

  // Função de atualização que será chamada a cada segundo
  function atualizar() {
    const resultado = calcularTempoRestante(data);
    timerElement.textContent = resultado.mensagem;

    if (resultado.expirado) {
      clearInterval(timersAtivos[postId]); // Para o timer
      timerElement.style.color = "red";
    } else {
      timerElement.style.color = postItElement.style.color; // Mantém a cor do texto definida
    }
  }

  // Executa imediatamente para evitar atraso de 1s
  atualizar();

  // Configura o novo intervalo e armazena o ID
  const intervalId = setInterval(atualizar, 1000);
  timersAtivos[postId] = intervalId;
}

// Função para parar o timer (usada ao excluir o post-it)
function pararContagem(postId) {
  if (timersAtivos[postId]) {
    clearInterval(timersAtivos[postId]);
    delete timersAtivos[postId];
  }
}

// --- FUNÇÕES DE INTERFACE ---

// Função que mostra o modal de edição/adição do post-it
function alerta(postItElement = null) {
  let isEditing = postItElement !== null;
  let initialData = {};

  // Se estiver editando, extrai os dados atuais do Post-it
  if (isEditing) {
    const container = postItElement;
    const dataElement = container.querySelector(".post-it-data");
    const titleElement = container.querySelector("h3");
    const descElement = container.querySelector("p");

    const dataFormatada = dataElement.textContent.trim().split("/");
    const dataOriginal =
      dataFormatada.length === 3
        ? `${dataFormatada[2]}-${dataFormatada[1]}-${dataFormatada[0]}`
        : "";

    initialData = {
      data: dataOriginal,
      titulo: titleElement.textContent.trim(),
      descricao: descElement.innerHTML.replace(/<br>/g, "\n").trim(),
      cor: container.style.backgroundColor || "#ffffa5",
      corTxt: container.style.color || "#000000",
    };
  } else {
    // Define valores padrão para um novo post-it
    initialData = {
      data: "",
      titulo: "",
      descricao: "",
      cor: "#ffffa5",
      corTxt: "#000000",
    };
  }

  Swal.fire({
    title: isEditing ? "Editar Anotação" : "Nova Anotação",
    customClass: {
      popup: "post-it-modal",
    },
    html: `
                  <div class="post-it-form">
                      <label for="date">Data:</label>
                      <input id="date" type="date" class="swal2-input" value="${initialData.data}">

                      <label for="nome" style="margin-top: 10px; display: block;">Título:</label>
                      <input id="nome" type="text" class="swal2-input" placeholder="Título da tarefa" value="${initialData.titulo}">

                      <label for="descricao" style="margin-top: 10px; display: block;">Descrição:</label>
                      <textarea id="descricao" class="swal2-textarea" placeholder="Detalhes e anotações...">${initialData.descricao}</textarea>

                      <label for="cor" style="margin-top: 10px; display: block;">Cor do Post-it:</label>
                      <input id="cor" type="color" class="swal2-input" value="${initialData.cor}" style="width: 50px; padding: 0; display: inline-block;">

                      <label for="corTxt" style="margin-top: 10px; display: block;">Cor do Texto:</label>
                      <input id="corTxt" type="color" class="swal2-input" value="${initialData.corTxt}" style="width: 50px; padding: 0; display: inline-block;">
                  </div>
              `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: isEditing ? "Salvar Alterações" : "Colar Post-it",
    cancelButtonText: "Cancelar",
    preConfirm: () => {
      const data = document.getElementById("date").value;
      const titulo = document.getElementById("nome").value;
      const descricao = document.getElementById("descricao").value;
      const cor = document.getElementById("cor").value;
      const corTxt = document.getElementById("corTxt").value;

      if (!data || !titulo || !descricao || !cor || !corTxt) {
        Swal.showValidationMessage("Preencha todos os campos!");
      }

      return { data, titulo, descricao, cor, corTxt };
    },
  }).then((result) => {
    if (result.value) {
      let lista = JSON.parse(sessionStorage.getItem("Dados")) || [];

      // Gera ou reaproveita ID
      const novoId = postItElement
        ? postItElement.getAttribute("data-post-id")
        : Date.now().toString();

      // Remover versão antiga ao editar, para evitar duplicação
      lista = lista.filter((item) => item.id !== novoId);

      // Adiciona ao array
      lista.push({
        id: novoId,
        data: result.value.data,
        titulo: result.value.titulo,
        descricao: result.value.descricao,
        cor: result.value.cor,
        corTxt: result.value.corTxt,
      });

      // Salva
      sessionStorage.setItem("Dados", JSON.stringify(lista));

      adicionarOuAtualizarPostIt(
        result.value.data,
        result.value.titulo,
        result.value.descricao,
        result.value.cor,
        result.value.corTxt,
        postItElement
      );
    }
  });
}

// Função que cria ou atualiza os post-its
function adicionarOuAtualizarPostIt(data, titulo, descricao, cor, textColor, postItElement) {
  if (postItElement) {
    // --- LÓGICA DE EDIÇÃO (ATUALIZAÇÃO) ---
    const container = postItElement;
    const postId = container.getAttribute("data-post-id");

    // Aplica as cores
    container.style.background = cor;
    container.style.color = textColor;

    // Atualiza os elementos internos
    container.querySelector(".post-it-data").textContent = formatarData(data);
    container.querySelector(".post-it-data").style.color = textColor;

    container.querySelector("h3").textContent = titulo;
    container.querySelector("h3").style.borderBottom = `2px solid ${textColor}`;

    container.querySelector("p").innerHTML = descricao.replace(/\n/g, "<br>");

    // Reinicia o timer com a nova data
    iniciarContagem(container, data);

    Swal.fire("Atualizado!", "O post-it foi editado com sucesso.", "success");
  } else {
    // --- LÓGICA DE ADIÇÃO (CRIAÇÃO) ---
    const container = document.getElementById("postItContainer");
    const rotation = getRandomRotation();
    const postId = Date.now().toString(); // ID único para o timer

    // Cria o elemento div principal do post-it
    const postIt = document.createElement("div");
    postIt.classList.add("post-it-item");
    postIt.setAttribute("data-post-id", postId); // Armazena o ID
    postIt.style.setProperty("--rotation", rotation);

    // Aplica as cores
    postIt.style.background = cor;
    postIt.style.color = textColor;

    // Adicionando os botões em uma div para alinhá-los lado a lado
    const btnContainer = document.createElement("div");
    btnContainer.classList.add("post-it-buttons");
    // Botões de Editar, Excluir e Concluir
    const btnExcluir = document.createElement("button");
    btnExcluir.classList.add("excluir-btn");
    btnExcluir.textContent = "Excluir";
    btnExcluir.onclick = function () {
      Swal.fire({
        title: "Tem certeza?",
        text: "Deseja remover esta anotação?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sim, remover!",
        cancelButtonText: "Cancelar",
      }).then((confirm) => {
        if (confirm.isConfirmed) {
          const postId = postIt.getAttribute("data-post-id");

          // REMOVER DO sessionStorage
          let lista = JSON.parse(sessionStorage.getItem("Dados")) || [];
          lista = lista.filter((item) => item.id !== postId);
          sessionStorage.setItem("Dados", JSON.stringify(lista));

          // Remove o timer
          pararContagem(postId);

          // Remove o post-it da tela
          postIt.remove();

          Swal.fire("Removido!", "O post-it foi retirado do mural.", "success");
        }
      });
    };

    const btnConclui = document.createElement("button");
    btnConclui.classList.add("btn-concluiu");
    btnConclui.textContent = "Concluir Tarefa";
    btnConclui.onclick = function () {
      const postId = postIt.getAttribute("data-post-id");

      // Remover a tarefa do sessionStorage
      let lista = JSON.parse(sessionStorage.getItem("Dados")) || [];
      lista = lista.filter((item) => item.id !== postId);
      sessionStorage.setItem("Dados", JSON.stringify(lista));

      // Parar o timer da tarefa
      pararContagem(postId);

      // Remover o post-it da tela
      postIt.remove();

      // Atualizar o contador de tarefas concluídas
      contadorDeConcluidas++;

      // Atualizar a exibição do contador
      atualizarContador();

      Swal.fire("Parabéns!", "Tarefa concluída.", "success");
    };

    const btnEditar = document.createElement("button");
    btnEditar.classList.add("excluir-btn");
    btnEditar.textContent = "Editar";
    btnEditar.onclick = function () {
      alerta(postIt);
    };

    // Adiciona os botões ao container
    btnContainer.appendChild(btnExcluir);
    btnContainer.appendChild(btnConclui);
    btnContainer.appendChild(btnEditar);

    postIt.appendChild(btnContainer);

    // Adiciona o conteúdo
    const htmlContent = `
      <span class="post-it-data" style="color: ${textColor};">${formatarData(data)}</span>
      <h3 style="border-bottom: 2px solid ${textColor};">${titulo}</h3>
      <p>${descricao.replace(/\n/g, "<br>")}</p>
      <div class="post-it-timer" style="font-weight: bold; margin-top: 10px;">Calculando...</div>
    `;

    postIt.insertAdjacentHTML("beforeend", htmlContent);

    // Adiciona ao container
    container.appendChild(postIt);

    // Inicia o timer para este novo post-it
    iniciarContagem(postIt, data);

    // Atualiza o contador ao carregar a página
    atualizarContador();

    return postIt;
  }
}

// Chama essa função quando a página é carregada
window.onload = function () {
  const lista = JSON.parse(sessionStorage.getItem("Dados")) || [];

  lista.forEach((item) => {
    const postIt = adicionarOuAtualizarPostIt(
      item.data,
      item.titulo,
      item.descricao,
      item.cor,
      item.corTxt,
      null
    );
  
    postIt.setAttribute("data-post-id", item.id);
  });
  
  // Exibe o contador de tarefas concluídas na página
  atualizarContador();
}