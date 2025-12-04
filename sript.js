// Armazena todos os IDs de intervalo ativos para que possamos limpá-los (parar o timer)
const timersAtivos = {};
const icons = [
  'icon/notebook-1-svgrepo-com.svg',
  'icon/alert-svgrepo-com.svg',
  'icon/study-university-svgrepo-com.svg'
];

// Declare esta variável ANTES de qualquer função que a use.
let contadorDeConcluidas = parseInt(localStorage.getItem('contadorDeConcluidas')) || 0;

// ============ FUNÇÕES DE IMPORTAÇÃO/EXPORTAÇÃO ============

// Função auxiliar para ler arquivo
function lerArquivoComoTexto(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      resolve(event.target.result);
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    reader.readAsText(file, 'UTF-8');
  });
}

// Função para converter texto para objetos
function converterTxtParaObjetos(textoTxt) {
  try {
    const textoLimpo = textoTxt.trim();
    
    // Padrão 1: Se começa com { ou [, é JSON
    if (textoLimpo.startsWith('[') || textoLimpo.startsWith('{')) {
      return converterDeJson(textoLimpo);
    }
    
    // Padrão 2: Se contém "TAREFA" ou "Item" (formato de exportação)
    if (textoTxt.includes('TAREFA') || textoTxt.includes('Item')) {
      return converterDeFormatoPersonalizado(textoTxt);
    }
    
    // Se não reconhecer nenhum formato
    throw new Error('Formato de arquivo não reconhecido');
    
  } catch (error) {
    console.error('Erro na conversão:', error);
    return [];
  }
}

// Converter de JSON
function converterDeJson(textoJson) {
  try {
    // Tenta converter diretamente
    const dados = JSON.parse(textoJson);
    
    // Se for um array, retorna formatado
    if (Array.isArray(dados)) {
      return dados.map(item => ({
        id: item.id || `importado_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        data: item.data || new Date().toISOString(),
        titulo: item.titulo || item.title || 'Tarefa Importada',
        descricao: item.descricao || item.description || '',
        cor: item.cor || item.color || '#ffffa5',
        corTxt: item.corTxt || item.textColor || '#000000',
        iconEscolha: item.iconEscolha || item.icon || '1'
      }));
    }
    
    // Se for um objeto único, coloca em array
    if (typeof dados === 'object' && dados !== null) {
      return [{
        id: dados.id || `importado_${Date.now()}`,
        data: dados.data || new Date().toISOString(),
        titulo: dados.titulo || dados.title || 'Tarefa Importada',
        descricao: dados.descricao || dados.description || '',
        cor: dados.cor || dados.color || '#ffffa5',
        corTxt: dados.corTxt || dados.textColor || '#000000',
        iconEscolha: dados.iconEscolha || dados.icon || '1'
      }];
    }
    
    return [];
    
  } catch (error) {
    console.error('Erro no parse JSON:', error);
    return [];
  }
}

// Converter do formato personalizado (que você exportou)
function converterDeFormatoPersonalizado(texto) {
  const tarefas = [];
  const linhas = texto.split('\n');
  let tarefaAtual = null;
  let coletandoDescricao = false;
  
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i].trim();
    
    if (linha === '---' || linha === '') {
      coletandoDescricao = false;
      continue;
    }
    
    // Detecta início de uma nova tarefa
    if (linha.startsWith('Item') || linha.startsWith('TAREFA')) {
      // Salva tarefa anterior se existir
      if (tarefaAtual) {
        tarefas.push(tarefaAtual);
      }
      
      // Nova tarefa
      tarefaAtual = {
        id: `importado_${Date.now()}_${tarefas.length + 1}`,
        data: new Date().toISOString(),
        titulo: '',
        descricao: '',
        cor: '#ffffa5',
        corTxt: '#000000',
        iconEscolha: '1'
      };
      
      // Extrai título se estiver na mesma linha
      const match = linha.match(/: (.+)$/);
      if (match) {
        tarefaAtual.titulo = match[1];
      }
      
    } else if (tarefaAtual) {
      // Extrai dados das linhas
      if (linha.startsWith('Título:') || linha.startsWith('Titulo:')) {
        tarefaAtual.titulo = linha.split(':')[1]?.trim() || 'Tarefa Importada';
      } 
      else if (linha.startsWith('Descrição:') || linha.startsWith('Descricao:')) {
        tarefaAtual.descricao = linha.split(':')[1]?.trim() || '';
        coletandoDescricao = true;
      }
      else if (coletandoDescricao && !linha.startsWith('Data:') && !linha.startsWith('Cor:')) {
        // Continuação da descrição
        tarefaAtual.descricao += ' ' + linha;
      }
      else if (linha.startsWith('Data:')) {
        const dataStr = linha.replace('Data:', '').trim();
        if (dataStr && dataStr !== 'Sem data') {
          try {
            // Tenta vários formatos de data
            let dataObj;
            if (dataStr.includes('/')) {
              const [dia, mes, ano] = dataStr.split(' ')[0].split('/');
              dataObj = new Date(`${ano}-${mes}-${dia}T00:00:00`);
            } else {
              dataObj = new Date(dataStr);
            }
            
            if (!isNaN(dataObj.getTime())) {
              tarefaAtual.data = dataObj.toISOString();
            }
          } catch {
            // Mantém a data padrão
          }
        }
      }
      else if (linha.startsWith('Cor:')) {
        const cor = linha.replace('Cor:', '').trim();
        if (cor && cor !== 'Sem cor') {
          tarefaAtual.cor = cor;
        }
      }
      else if (linha.startsWith('Cor do texto:')) {
        const corTxt = linha.replace('Cor do texto:', '').trim();
        if (corTxt) {
          tarefaAtual.corTxt = corTxt;
        }
      }
      else if (linha.startsWith('Ícone:') || linha.startsWith('Icone:')) {
        const icon = linha.split(':')[1]?.trim();
        if (icon && ['1', '2', '3'].includes(icon)) {
          tarefaAtual.iconEscolha = icon;
        }
      }
    }
  }
  
  // Adiciona a última tarefa
  if (tarefaAtual && tarefaAtual.titulo) {
    tarefas.push(tarefaAtual);
  }
  
  return tarefas;
}

// Função para carregar post-its (reutilizável)
function carregarPostIts(dadosArray) {
  // Limpa timers ativos
  Object.keys(timersAtivos).forEach(postId => {
    pararContagem(postId);
  });
  
  // Carrega os novos post-its
  if (dadosArray && dadosArray.length > 0) {
    dadosArray.forEach((item) => {
      // Verifica se o elemento já não existe
      const existingElement = document.querySelector(`[data-post-id="${item.id}"]`);
      if (!existingElement) {
        adicionarOuAtualizarPostIt(
          item.data,
          item.titulo,
          item.descricao,
          item.cor,
          item.corTxt,
          item.iconEscolha,
          null,
          item.id
        );
      }
    });
    
    return true;
  }
  
  return false;
}

// ============ FUNÇÕES PRINCIPAIS DE IMPORTAR ============

// Função principal de importação de JSON
function importarDeJson() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.onchange = async (event) => {
    const file = event.target.files[0];
    
    if (!file) {
      alert('Nenhum arquivo selecionado!');
      return;
    }
    
    // Verifica se é JSON
    if (!file.name.toLowerCase().endsWith('.json')) {
      alert('Por favor, selecione um arquivo .json!');
      return;
    }
    
    try {
      const texto = await lerArquivoComoTexto(file);
      const dados = JSON.parse(texto);
      
      if (!Array.isArray(dados)) {
        alert('O arquivo JSON não contém um array de tarefas!');
        return;
      }
      
      // Valida os dados
      const dadosValidos = dados.filter(item => 
        item && typeof item === 'object' && 
        (item.titulo || item.descricao)
      ).map(item => ({
        id: item.id || `importado_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        data: item.data || new Date().toISOString(),
        titulo: item.titulo || 'Tarefa Importada',
        descricao: item.descricao || '',
        cor: item.cor || '#ffffa5',
        corTxt: item.corTxt || '#000000',
        iconEscolha: item.iconEscolha || '1'
      }));
      
      if (dadosValidos.length === 0) {
        alert('Nenhuma tarefa válida encontrada no arquivo!');
        return;
      }
      
      const opcao = confirm(
        `Encontradas ${dadosValidos.length} tarefas válidas.\n\n` +
        `OK: Adicionar às existentes\n` +
        `Cancelar: Substituir todas`
      );
      
      let dadosFinais;
      
      if (opcao) {
        // ADICIONAR
        const dadosExistentes = JSON.parse(localStorage.getItem("Dados") || '[]');
        dadosFinais = [...dadosExistentes, ...dadosValidos];
      } else {
        // SUBSTITUIR
        dadosFinais = dadosValidos;
        // Limpa interface
        Object.keys(timersAtivos).forEach(postId => pararContagem(postId));
        document.getElementById("postItContainer").innerHTML = '';
      }
      
      // Salva e carrega
      localStorage.setItem("Dados", JSON.stringify(dadosFinais));
      carregarPostIts(dadosFinais);
      
      Swal.fire({
        icon: 'success',
        title: 'Importação concluída!',
        text: `Total de tarefas: ${dadosFinais.length}`,
        timer: 3000
      });
      
    } catch (error) {
      console.error('Erro na importação JSON:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erro na importação',
        text: error.message,
      });
    }
  };
  
  input.click();
}

// Função principal de importação de TXT
function importarDeTxt() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt';
  
  input.onchange = async (event) => {
    const file = event.target.files[0];
    
    if (!file) {
      alert('Nenhum arquivo selecionado!');
      return;
    }
    
    // Mostra loading
    Swal.fire({
      title: 'Importando...',
      text: 'Processando arquivo TXT, aguarde.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
    
    try {
      const texto = await lerArquivoComoTexto(file);
      const dadosConvertidos = converterTxtParaObjetos(texto);
      
      if (dadosConvertidos.length === 0) {
        Swal.close();
        Swal.fire({
          icon: 'warning',
          title: 'Nenhuma tarefa encontrada',
          text: 'O arquivo não contém tarefas no formato correto.',
        });
        return;
      }
      
      Swal.close();
      const opcao = confirm(
        `Encontradas ${dadosConvertidos.length} tarefas.\n\n` +
        `OK: Adicionar às existentes\n` +
        `Cancelar: Substituir todas`
      );
      
      let dadosFinais;
      
      if (opcao) {
        // ADICIONAR
        const dadosExistentes = JSON.parse(localStorage.getItem("Dados") || '[]');
        dadosFinais = [...dadosExistentes, ...dadosConvertidos];
      } else {
        // SUBSTITUIR
        dadosFinais = dadosConvertidos;
        // Limpa interface
        Object.keys(timersAtivos).forEach(postId => pararContagem(postId));
        document.getElementById("postItContainer").innerHTML = '';
      }
      
      // Salva e carrega
      localStorage.setItem("Dados", JSON.stringify(dadosFinais));
      carregarPostIts(dadosFinais);
      
      Swal.fire({
        icon: 'success',
        title: 'Importação TXT concluída!',
        text: `Total de tarefas: ${dadosFinais.length}`,
        timer: 3000
      });
      
    } catch (error) {
      Swal.close();
      console.error('Erro na importação TXT:', error);
      Swal.fire({
        icon: 'error',
        title: 'Erro na importação',
        text: error.message,
      });
    }
  };
  
  input.click();
}

// Função para criar arquivo de teste
function criarArquivoTeste() {
  const dadosTeste = [
    {
      id: 'teste_1',
      data: new Date(Date.now() + 86400000).toISOString(), // Amanhã
      titulo: 'Tarefa de Teste 1',
      descricao: 'Esta é uma tarefa de teste para importação',
      cor: '#ffffa5',
      corTxt: '#000000',
      iconEscolha: '1'
    },
    {
      id: 'teste_2',
      data: new Date(Date.now() + 172800000).toISOString(), // Depois de amanhã
      titulo: 'Tarefa Importante',
      descricao: 'Outra tarefa para testar a importação',
      cor: '#ffcccc',
      corTxt: '#000000',
      iconEscolha: '2'
    }
  ];
  
  const json = JSON.stringify(dadosTeste, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'teste-importacao.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  Swal.fire({
    icon: 'success',
    title: 'Arquivo de teste criado!',
    text: 'Agora tente importá-lo usando o botão "Importar JSON".',
    timer: 3000
  });
}

// ============ FUNÇÕES EXISTENTES (COMPLETAS) ============

// Função para atualizar o contador de tarefas concluídas
function atualizarContador() {
  document.getElementById("contadorTarefas").textContent = `Tarefas Concluídas: ${contadorDeConcluidas}`;
  localStorage.setItem('contadorDeConcluidas', contadorDeConcluidas);
}

// Função para gerar uma rotação aleatória para os post-its
function getRandomRotation() {
  return Math.floor(Math.random() * 9) - 4;
}

// Função para formatar a data e hora corretamente
function formatarData(data) {
  if (!data) return "";
  const [dataParte, horaParte] = data.split("T");
  const [ano, mes, dia] = dataParte.split("-");
  const [hora = "00", minuto = "00", segundo = "00"] = horaParte ? horaParte.split(":") : [];
  return `${dia}/${mes}/${ano} ${hora}:${minuto}:${segundo}`;
}

// Função que faz o cálculo e formatação do tempo restante
function calcularTempoRestante(dataAlvo) {
  const dataInformada = new Date(dataAlvo).getTime();
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
      timerElement.style.color = postItElement.style.color;
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

// Função auxiliar para remover post-it do localStorage e DOM (evita duplicação)
function removerPostIt(postId) {
  let lista = JSON.parse(localStorage.getItem("Dados")) || [];
  lista = lista.filter((item) => item.id !== postId);
  localStorage.setItem("Dados", JSON.stringify(lista));
  
  pararContagem(postId);
  const elemento = document.querySelector(`[data-post-id="${postId}"]`);
  if (elemento) elemento.remove();
  
  return true;
}

// --- FUNÇÕES DE INTERFACE ---

// Função que mostra o modal de edição/adição do post-it
function alerta(postItElement = null) {
  let isEditing = postItElement !== null;
  let initialData = {};

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
        <label for="date">Data e Hora:</label>
        <input id="date" type="datetime-local" class="swal2-input" value="${initialData.data}">

        <label for="nome" style="margin-top: 10px; display: block;">Título:</label>
        <input id="nome" type="text" class="swal2-input" placeholder="Título da tarefa" value="${initialData.titulo}">

        <label for="descricao" style="margin-top: 10px; display: block;">Descrição:</label>
        <textarea id="descricao" class="swal2-textarea" placeholder="Detalhes e anotações...">${initialData.descricao}</textarea>

        <label for="cor" style="margin-top: 10px; display: block;">Cor do Post-it:</label>
        <input id="cor" type="color" class="swal2-input" value="${initialData.cor}" style="width: 50px; padding: 0; display: inline-block;">

        <label for="corTxt" style="margin-top: 10px; display: block;">Cor do Texto:</label>
        <input id="corTxt" type="color" class="swal2-input" value="${initialData.corTxt}" style="width: 50px; padding: 0; display: inline-block;">

        <div class="select-container" style="display: flex; justify-content: center; margin-top: 10px;">
          <select id="cidades" name="cidades">
            <option value="1">Anotação</option>
            <option value="2">Importante</option>
            <option value="3">Estudar</option>
          </select>
        </div>
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
      const iconChc = document.getElementById("cidades").value;

      if (!data || !titulo || !descricao || !cor || !corTxt) {
        Swal.showValidationMessage("Preencha todos os campos!");
        return false;
      }

      // Validação de data futura
      if (new Date(data) < new Date()) {
        Swal.showValidationMessage("A data deve ser futura!");
        return false;
      }

      return { data, titulo, descricao, cor, corTxt, iconChc };
    },
  }).then((result) => {
    if (result.value) {
      let lista = JSON.parse(localStorage.getItem("Dados")) || [];
      const novoId = isEditing ? postItElement.getAttribute("data-post-id") : Date.now().toString();
      
      // Remove o post-it caso já exista (para edição ou prevenção de duplicados)
      lista = lista.filter((item) => item.id !== novoId);
      
      lista.push({
        id: novoId,
        data: result.value.data,
        titulo: result.value.titulo,
        descricao: result.value.descricao,
        cor: result.value.cor,
        corTxt: result.value.corTxt,
        iconEscolha: result.value.iconChc
      });

      localStorage.setItem("Dados", JSON.stringify(lista));

      adicionarOuAtualizarPostIt(
        result.value.data,
        result.value.titulo,
        result.value.descricao,
        result.value.cor,
        result.value.corTxt,
        result.value.iconChc,
        postItElement,
        isEditing ? null : novoId
      );
    }
  });
}

// Função que cria ou atualiza os post-its
function adicionarOuAtualizarPostIt(data, titulo, descricao, cor, textColor, iconChc, postItElement, postId = null) {
  // Se estiver editando um post-it existente
  if (postItElement) {
    const container = postItElement;
    const postId = container.getAttribute("data-post-id");

    container.style.background = cor;
    container.style.color = textColor;

    container.querySelector(".post-it-data").textContent = formatarData(data);
    container.querySelector(".post-it-data").style.color = textColor;

    container.querySelector("h3").textContent = titulo;
    container.querySelector("h3").style.borderBottom = `2px solid ${textColor}`;
    container.querySelector("h3").style.color = textColor;

    container.querySelector("p").innerHTML = descricao.replace(/\n/g, "<br>");
    container.querySelector("p").style.color = textColor;
    
    // Atualiza o ícone
    const imgElement = container.querySelector("img");
    if (imgElement) {
      imgElement.src = icons[iconChc-1];
    }

    // Reinicia o timer com a nova data
    iniciarContagem(container, data);

    Swal.fire("Atualizado!", "O post-it foi editado com sucesso.", "success");
    return container;
  } 
  // Se for criação de um novo post-it
  else {
    const container = document.getElementById("postItContainer");
    const rotation = getRandomRotation();
    const newPostId = postId || Date.now().toString();

    const postIt = document.createElement("div");
    postIt.classList.add("post-it-item");
    postIt.setAttribute("data-post-id", newPostId);
    postIt.style.setProperty("--rotation", rotation);

    postIt.style.background = cor;
    postIt.style.color = textColor;

    // Criação dos botões
    const btnContainer = document.createElement("div");
    btnContainer.classList.add("post-it-buttons");

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
          removerPostIt(postId);
          Swal.fire("Removido!", "O post-it foi retirado do mural.", "success");
        }
      });
    };

    const btnConclui = document.createElement("button");
    btnConclui.classList.add("btn-concluiu");
    btnConclui.textContent = "Concluir Tarefa";
    btnConclui.onclick = function () {
      const postId = postIt.getAttribute("data-post-id");
      removerPostIt(postId);
      contadorDeConcluidas++;
      localStorage.setItem('contadorDeConcluidas', contadorDeConcluidas);
      atualizarContador();
      Swal.fire("Parabéns!", "Tarefa concluída.", "success");
    };

    const btnEditar = document.createElement("button");
    btnEditar.classList.add("excluir-btn");
    btnEditar.textContent = "Editar";
    btnEditar.onclick = function () {
      alerta(postIt);
    };

    btnContainer.appendChild(btnExcluir);
    btnContainer.appendChild(btnConclui);
    btnContainer.appendChild(btnEditar);

    postIt.appendChild(btnContainer);

    // Adicionando ícone com base na escolha
    const iconSrc = icons[iconChc - 1];
    const imgTag = document.createElement('img');
    imgTag.src = iconSrc;
    imgTag.width = 30;
    imgTag.height = 30;
    imgTag.style.position = 'absolute';
    imgTag.style.bottom = '15px';
    imgTag.style.right = '10px';
    postIt.appendChild(imgTag);

    // Adicionando o conteúdo do post-it
    const htmlContent = `
      <span class="post-it-data" style="color: ${textColor};">${formatarData(data)}</span>
      <h3 style="border-bottom: 2px solid ${textColor}; color: ${textColor};">${titulo}</h3>
      <p style="color: ${textColor};">${descricao.replace(/\n/g, "<br>")}</p>
      <div class="post-it-timer" style="font-weight: bold; margin-top: 10px;">Calculando...</div>
    `;
    postIt.insertAdjacentHTML("beforeend", htmlContent);

    container.appendChild(postIt);
    iniciarContagem(postIt, data);
    atualizarContador();
    
    return postIt;
  }
}

// Função de exportação para TXT
function extraiLocal() {
  let valoresArmazenados = "";
  const dadosString = localStorage.getItem("Dados");
  
  if (!dadosString) {
    return "Nenhum dado encontrado no localStorage";
  }
  
  let jsonString = dadosString.trim();
  if (!jsonString.startsWith('[')) jsonString = '[' + jsonString;
  if (!jsonString.endsWith(']')) jsonString = jsonString + ']';
  
  let parseado = [];
  
  try {
    parseado = JSON.parse(jsonString);
    
    if (!Array.isArray(parseado)) {
      return "Os dados não são um array!";
    }
    
    // Cabeçalho formatado
    valoresArmazenados += "=".repeat(50) + "\n";
    valoresArmazenados += "EXPORTAÇÃO DE TAREFAS - POST-IT NOTES\n";
    valoresArmazenados += "=".repeat(50) + "\n\n";
    valoresArmazenados += `Data da exportação: ${new Date().toLocaleString('pt-BR')}\n`;
    valoresArmazenados += `Total de tarefas: ${parseado.length}\n\n`;
    
    for (let i = 0; i < parseado.length; i++) {
      let item = parseado[i];
      
      valoresArmazenados += `TAREFA ${i + 1}\n`;
      valoresArmazenados += "-".repeat(30) + "\n";
      valoresArmazenados += `Título: ${item.titulo || "Sem título"}\n`;
      valoresArmazenados += `Descrição: ${item.descricao || "Sem descrição"}\n`;
      
      if (item.data) {
        const dataObj = new Date(item.data);
        valoresArmazenados += `Data: ${dataObj.toLocaleDateString('pt-BR')}\n`;
        valoresArmazenados += `Hora: ${dataObj.toLocaleTimeString('pt-BR')}\n`;
      } else {
        valoresArmazenados += "Data: Sem data\n";
      }
      
      valoresArmazenados += `Cor: ${item.cor || "Sem cor"}\n`;
      valoresArmazenados += `Cor do texto: ${item.corTxt || "#000000"}\n`;
      valoresArmazenados += `Ícone: ${item.iconEscolha || "1"}\n`;
      valoresArmazenados += `ID: ${item.id || "Sem ID"}\n`;
      valoresArmazenados += "\n" + "=".repeat(50) + "\n\n";
    }
    
  } catch (erro) {
    console.error("Erro ao converter JSON:", erro);
    return `Erro ao processar dados: ${erro.message}`;
  }
  
  return valoresArmazenados;
}

function exportarParaTxt() {
  try {
    const conteudo = extraiLocal();
    
    if (!conteudo || conteudo.includes("Nenhum dado") || conteudo.includes("Erro")) {
      alert(conteudo || "Não há dados para exportar!");
      return false;
    }
    
    const blob = new Blob([conteudo], { 
      type: 'text/plain;charset=utf-8' 
    });
    
    const url = URL.createObjectURL(blob);
    const dataAtual = new Date();
    const nomeArquivo = `post-it-notes_${dataAtual.toISOString().split('T')[0]}.txt`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    
    Swal.fire({
      icon: 'success',
      title: 'Exportação TXT concluída!',
      text: `Arquivo "${nomeArquivo}" baixado com sucesso.`,
      timer: 3000
    });
    
    return true;
    
  } catch (error) {
    console.error("Erro ao exportar:", error);
    alert(`Erro ao exportar arquivo: ${error.message}`);
    return false;
  }
}

// Função de exportação JSON
function exportarParaJson() {
  try {
    const dadosString = localStorage.getItem("Dados");
    
    if (!dadosString || dadosString === '[]') {
      alert('Não há dados para exportar!');
      return false;
    }
    
    // Tenta parsear para verificar se é JSON válido
    const dados = JSON.parse(dadosString);
    
    // Formata bonito
    const jsonFormatado = JSON.stringify(dados, null, 2);
    
    const blob = new Blob([jsonFormatado], { 
      type: 'application/json;charset=utf-8' 
    });
    
    const url = URL.createObjectURL(blob);
    const dataAtual = new Date();
    const nomeArquivo = `post-it-backup_${dataAtual.toISOString().split('T')[0]}.json`;
    
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
    
    Swal.fire({
      icon: 'success',
      title: 'Backup JSON exportado!',
      text: `Arquivo "${nomeArquivo}" salvo com sucesso.`,
      timer: 3000
    });
    
    return true;
    
  } catch (error) {
    console.error("Erro ao exportar JSON:", error);
    alert(`Erro ao exportar: ${error.message}`);
    return false;
  }
}

// Carregamento inicial
window.onload = function () {
  Object.keys(timersAtivos).forEach(postId => {
    pararContagem(postId);
  });

  const lista = JSON.parse(localStorage.getItem("Dados")) || [];
  
  if (lista.length > 0) {
    lista.forEach((item) => {
      const existingElement = document.querySelector(`[data-post-id="${item.id}"]`);
      if (!existingElement) {
        adicionarOuAtualizarPostIt(
          item.data,
          item.titulo,
          item.descricao,
          item.cor,
          item.corTxt,
          item.iconEscolha,
          null,
          item.id
        );
      }
    });
  }

  atualizarContador();
};

// Event listeners
window.addEventListener('beforeunload', function() {
  Object.keys(timersAtivos).forEach(postId => {
    clearInterval(timersAtivos[postId]);
  });
});

// Função para limpar tudo
function limparTodosPostIts() {
  Swal.fire({
    title: "Limpar tudo?",
    text: "Esta ação removerá TODOS os post-its e não pode ser desfeita!",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "Sim, limpar tudo!",
    cancelButtonText: "Cancelar"
  }).then((result) => {
    if (result.isConfirmed) {
      Object.keys(timersAtivos).forEach(postId => {
        pararContagem(postId);
      });
      
      localStorage.removeItem("Dados");
      localStorage.removeItem("contadorDeConcluidas");
      
      contadorDeConcluidas = 0;
      atualizarContador();
      
      const container = document.getElementById("postItContainer");
      if (container) {
        container.innerHTML = '';
      }
      
      Swal.fire("Limpo!", "Todos os post-its foram removidos.", "success");
    }
  });
}

async function getGroqResponse(apiKey, userMessage, model = 'llama-3.1-8b-instant') {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: 'Você é um assistente útil.' },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7,
                max_tokens: 1024
            })
        });

        if (!response.ok) throw new Error('Erro na API');
        
        const data = await response.json();
        return data.choices[0]?.message?.content || 'Sem resposta';
        
    } catch (error) {
        console.error('Erro:', error);
        return 'Desculpe, ocorreu um erro ao processar sua solicitação.';
    }
}

// Uso mais simples ainda:

const WORKER_URL = 'https://gargamel-ai.davi-af26.workers.dev';

// Elementos DOM
const chatWrapper = document.querySelector('.chat-wrapper');
const chatContainer = document.getElementById('chatContainer');
const chatButton = document.getElementById('chatButton');
const chatHeader = document.getElementById('chatHeader');
const minimizeBtn = document.getElementById('minimizeBtn');
const closeBtn = document.getElementById('closeBtn');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const notificationBadge = document.getElementById('notificationBadge');

// Estado (APENAS UM array para histórico)
let isExpanded = false;
let unreadMessages = 0;
let chatHistory = []; // <- ÚNICO array de histórico

// Expandir chat
function expandChat() {
    chatContainer.classList.add('expanded');
    chatButton.style.display = 'none';
    isExpanded = true;
    messageInput.focus();
    
    // Resetar notificações
    unreadMessages = 0;
    notificationBadge.style.display = 'none';
}

// Minimizar chat
function minimizeChat() {
    chatContainer.classList.remove('expanded');
    chatButton.style.display = 'flex';
    isExpanded = false;
}

// Fechar chat
function closeChat() {
    if (confirm('Tem certeza que deseja fechar o chat?')) {
        minimizeChat();
    }
}

// ADICIONAR MENSAGEM VISUAL (CORRIGIDA)
function addMessageToChat(sender, content, isError = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.style.whiteSpace = 'pre-wrap';  // ← MAGIC HERE
    messageDiv.style.wordBreak = 'break-word';
    if (isError) {
        messageDiv.style.background = '#ffebee';
        messageDiv.style.color = '#c62828';
        messageDiv.style.border = '1px solid #ffcdd2';
    }
    
    const senderName = sender === 'user' ? '👤 Você' : '🤖 Assistente';
    const formattedContent = content
        .replace(/\n/g, '<br>')  // Quebras de linha
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // Negrito **texto**
        .replace(/\*(.*?)\*/g, '<em>$1</em>');  // Itálico *texto*

    messageDiv.innerHTML = `<strong>${senderName}:</strong><br>${formattedContent}`;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Notificação se chat minimizado
    if (!isExpanded && sender === 'assistant') {
        unreadMessages++;
        notificationBadge.textContent = unreadMessages;
        notificationBadge.style.display = 'flex';
    }
}

// ENVIAR MENSAGEM (CORRIGIDA)
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Limpar input
    input.value = '';
    
    // Adicionar mensagem do usuário VISUALMENTE
    addMessageToChat('user', message);
    
    // Adicionar ao histórico
    chatHistory.push({ role: 'user', content: message });
    
    console.log('Enviando mensagem:', message);
    console.log('Histórico atual:', chatHistory);
    
    try {
        // Enviar para o worker
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                history: chatHistory,
                model: 'llama-3.1-8b-instant'
            })
        });
        
        console.log('Resposta do worker:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Resposta JSON:', data);
        
        if (data.error) {
            addMessageToChat('assistant', `Erro: ${data.error}`, true);
        } else if (data.response) {
            // Adicionar resposta da IA VISUALMENTE
            addMessageToChat('assistant', data.response);
            
            // Adicionar ao histórico
            chatHistory.push({ role: 'assistant', content: data.response });
            
            console.log('Histórico atualizado:', chatHistory.length, 'mensagens');
        }
        
    } catch (error) {
        console.error('Erro:', error);
        addMessageToChat('assistant', `Erro: ${error.message}`, true);
    }
}

// Event Listeners
chatButton.addEventListener('click', expandChat);
chatHeader.addEventListener('click', minimizeChat);

minimizeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    minimizeChat();
});

closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeChat();
});

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Fechar ao clicar fora
document.addEventListener('click', (e) => {
    if (isExpanded && 
        !chatContainer.contains(e.target) && 
        !chatButton.contains(e.target)) {
        minimizeChat();
    }
});

// Auto-expand após alguns segundos
setTimeout(() => {
    if (!isExpanded) {
        expandChat();
    }
}, 3000);