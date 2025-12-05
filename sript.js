// Armazena todos os IDs de intervalo ativos para que possamos limpá-los (parar o timer)
const timersAtivos = {};
const CORES_MAP = {
  'amarelo': '#ffffa5', 'vermelho': '#ffcccc', 'verde': '#ccffcc',
  'azul': '#cce5ff', 'roxo': '#e6ccff', 'rosa': '#ffccf9',
  'laranja': '#ffddcc', 'cinza': '#f0f0f0',
  'yellow': '#ffffa5', 'red': '#ffcccc', 'green': '#ccffcc',
  'blue': '#cce5ff', 'purple': '#e6ccff', 'pink': '#ffccf9',
  'orange': '#ffddcc', 'gray': '#f0f0f0'
};
const icons = [
  'icon/notebook-1-svgrepo-com.svg',
  'icon/alert-svgrepo-com.svg',
  'icon/study-university-svgrepo-com.svg',
  'icon/party-horn-svgrepo-com.svg',
  'icon/picture-svgrepo-com.svg',
  'icon/reminder-alert-svgrepo-com.svg',
  'icon/alert-triangle-svgrepo-com.svg'
];
const ICON_EMOJI_MAP = {
  1: '📝', 2: '💡', 3: '⚠️', 4: '🎯', 5: '📚',
  6: '🏃', 7: '💰', 8: '❤️', 9: '🛒', 10: '🎂'
};

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
  const dataObj = new Date(data);
  if (isNaN(dataObj.getTime())) return "";
  
  const dia = String(dataObj.getDate()).padStart(2, '0');
  const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
  const ano = dataObj.getFullYear();
  const hora = String(dataObj.getHours()).padStart(2, '0');
  const minuto = String(dataObj.getMinutes()).padStart(2, '0');
  const segundo = String(dataObj.getSeconds()).padStart(2, '0');
  
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
    const dataOriginal = dataFormatada.length === 3
      ? `${dataFormatada[2]}-${dataFormatada[1]}-${dataFormatada[0]}T00:00:00`
      : new Date().toISOString().slice(0, 16);

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

      if (!titulo.trim()) {
        Swal.showValidationMessage("Digite um título!");
        return false;
      }

      if (!data) {
        Swal.showValidationMessage("Selecione uma data!");
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
      const novoId = isEditing ? postItElement.getAttribute("data-post-id") : `postit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
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

    // Atualiza visual
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

    // Reinicia o timer
    iniciarContagem(container, data);

    // Atualiza localStorage
    let lista = JSON.parse(localStorage.getItem("Dados")) || [];
    lista = lista.filter(item => item.id !== postId); // Remove antigo
    lista.push({
      id: postId,
      data: data,
      titulo: titulo,
      descricao: descricao,
      cor: cor,
      corTxt: textColor,
      iconEscolha: iconChc.toString()
    });
    localStorage.setItem("Dados", JSON.stringify(lista));

    Swal.fire("Atualizado!", "O post-it foi editado com sucesso.", "success");
    return container;
  } 
  // Se for criação de um novo post-it
  else {
    const container = document.getElementById("postItContainer");
    const rotation = getRandomRotation();
    const newPostId = postId || `postit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

    // Adicionando ícone
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
    
    // Salva no localStorage
    let lista = JSON.parse(localStorage.getItem("Dados")) || [];
    lista.push({
      id: newPostId,
      data: data,
      titulo: titulo,
      descricao: descricao,
      cor: cor,
      corTxt: textColor,
      iconEscolha: iconChc.toString()
    });
    localStorage.setItem("Dados", JSON.stringify(lista));
    
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
  
  try {
    const parseado = JSON.parse(dadosString);
    
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

// ============ CHAT IA FUNCTIONS ============
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

// Adicionar mensagem ao chat
function addMessageToChat(sender, content, isError = false, isFunctionCall = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.style.whiteSpace = 'pre-wrap';
    messageDiv.style.wordBreak = 'break-word';
    
    if (isError) {
        messageDiv.style.background = '#ffebee';
        messageDiv.style.color = '#c62828';
        messageDiv.style.border = '1px solid #ffcdd2';
    }
    
    if (isFunctionCall) {
        messageDiv.style.background = '#e3f2fd';
        messageDiv.style.borderLeft = '4px solid #2196f3';
    }
    
    const senderName = sender === 'user' ? '👤 Você' : '🤖 Assistente';
    const formattedContent = content
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');

    messageDiv.innerHTML = `<strong>${senderName}:</strong><br>${formattedContent}`;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Notificação se chat minimizado
    if (!isExpanded && sender === 'assistant' && !isFunctionCall) {
        unreadMessages++;
        notificationBadge.textContent = unreadMessages;
        notificationBadge.style.display = 'flex';
    }
}

// Enviar mensagem
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // Limpar input
    input.value = '';
    
    // Adicionar mensagem do usuário
    addMessageToChat('user', message);
    chatHistory.push({ role: 'user', content: message });
    
    // Mostrar indicador de "digitando..."
    showTypingIndicator();
    
    try {
        // Enviar para o worker
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                message: message,
                history: chatHistory,
                model: 'llama-3.1-8b-instant'
            })
        });
        
        // Remover indicador de "digitando..."
        hideTypingIndicator();
        
        // Verificar se a resposta é OK
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro HTTP:', response.status, errorText);
            throw new Error(`Erro do servidor: ${response.status} ${response.statusText}`);
        }
        
        // Processar resposta
        const data = await response.json();
        console.log('📦 Resposta completa do worker:', data);
        
        // CASO 1: Function calls - múltiplos post-its
        if (data.action === "function_calls" && data.function_name === "create_post_it") {
            const postIts = data.arguments; // Array de post-its
            
            console.log(`🎯 ${postIts.length} post-it(s) detectados:`, postIts);
            
            // Mostrar resposta textual da IA (se houver)
            if (data.text_response && data.text_response.trim()) {
                addMessageToChat('assistant', data.text_response);
                chatHistory.push({ role: 'assistant', content: data.text_response });
            }
            
            // Mostrar cada post-it individualmente
            postIts.forEach((postItArgs, index) => {
                console.log(`📝 Processando post-it ${index + 1}:`, postItArgs);
                
                showPostItConfirmation(
                    postItArgs, 
                    `Post-it ${index + 1} de ${postIts.length}: "${postItArgs.titulo}"`,
                    index + 1,
                    postIts.length,
                    postIts // Passa o array completo para o botão "Criar Todos"
                );
            });
            
            // Mostrar resumo se houver múltiplos
            if (postIts.length > 1) {
                setTimeout(() => {
                    addMessageToChat('assistant', 
                        `✨ Encontrei ${postIts.length} tarefas para você. Confirme cada uma acima!`,
                        false,
                        true
                    );
                }, 300);
            }
            
            // Mostrar erros se houver
            if (data.errors && data.errors.length > 0) {
                console.warn('⚠️ Erros no processamento:', data.errors);
                setTimeout(() => {
                    addMessageToChat('assistant', 
                        `⚠️ Alguns post-its tiveram problemas: ${data.errors.join(', ')}`,
                        true
                    );
                }, 500);
            }
        }
        
        // CASO 2: Function call - único post-it (compatibilidade com versões antigas)
        else if (data.action === "function_call" && data.function_name === "create_post_it") {
            console.log('🎯 Post-it único detectado:', data.arguments);
            
            const args = data.arguments;
            
            // Mostrar resposta da IA
            if (data.text_response && data.text_response.trim()) {
                addMessageToChat('assistant', data.text_response);
                chatHistory.push({ role: 'assistant', content: data.text_response });
            }
            
            // Mostrar confirmação do post-it
            showPostItConfirmation(
                args, 
                data.text_response || `Criando: "${args.titulo}"`,
                1,
                1,
                [args] // Array com um único item
            );
        }
        
        // CASO 3: Erro do worker
        else if (data.error) {
            console.error('❌ Erro do worker:', data.error);
            addMessageToChat('assistant', `⚠️ Erro: ${data.error}`, true);
        }
        
        // CASO 4: Resposta normal da IA (sem post-its)
        else if (data.response) {
            console.log('💬 Resposta normal da IA:', data.response.substring(0, 100) + '...');
            addMessageToChat('assistant', data.response);
            chatHistory.push({ role: 'assistant', content: data.response });
        }
        
        // CASO 5: Resposta inesperada
        else {
            console.warn('⚠️ Resposta inesperada do worker:', data);
            addMessageToChat('assistant', 
                'Ops, recebi uma resposta inesperada. Tente novamente!', 
                true
            );
        }
        
    } catch (error) {
        // Tratamento de erro
        hideTypingIndicator();
        console.error('💥 Erro crítico:', error);
        
        // Mensagens de erro amigáveis
        let errorMessage = 'Erro desconhecido';
        
        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Não foi possível conectar ao servidor. Verifique sua internet.';
        } else if (error.message.includes('NetworkError')) {
            errorMessage = 'Erro de rede. Tente novamente.';
        } else if (error.message.includes('timeout')) {
            errorMessage = 'Tempo de resposta excedido. O servidor pode estar lento.';
        } else {
            errorMessage = `Erro: ${error.message}`;
        }
        
        addMessageToChat('assistant', errorMessage, true);
        
        // Tentar reconexão automática
        setTimeout(() => {
            if (navigator.onLine) {
                console.log('🔄 Tentando reconectar...');
                addMessageToChat('assistant', 'Tentando reconectar...', false, true);
            }
        }, 2000);
    }
    
    // Focar novamente no input
    setTimeout(() => {
        messageInput.focus();
    }, 100);
}

// Função para mostrar indicador de "digitando"
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.id = 'typingIndicator';
    typingDiv.className = 'message ai-message';
    typingDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; color: #666;">
            <div style="display: flex; gap: 4px;">
                <div style="width: 8px; height: 8px; background: #667eea; border-radius: 50%; animation: typing 1.4s infinite;"></div>
                <div style="width: 8px; height: 8px; background: #667eea; border-radius: 50%; animation: typing 1.4s infinite 0.2s;"></div>
                <div style="width: 8px; height: 8px; background: #667eea; border-radius: 50%; animation: typing 1.4s infinite 0.4s;"></div>
            </div>
            <span>Digitando...</span>
        </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes typing {
            0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
            30% { opacity: 1; transform: translateY(-5px); }
        }
    `;
    document.head.appendChild(style);
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
    const typingDiv = document.getElementById('typingIndicator');
    if (typingDiv) typingDiv.remove();
}

// Função para mostrar confirmação de criação de post-it
function showPostItConfirmation(args, aiMessage, index = 1, total = 1, allPostIts = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message function-call-message';
    messageDiv.style.background = '#e3f2fd';
    messageDiv.style.border = '1px solid #bbdefb';
    messageDiv.style.borderLeft = '4px solid #2196f3';
    messageDiv.dataset.postitIndex = index;
    messageDiv.dataset.postitData = JSON.stringify(args); // 👈 ARMAZENA OS DADOS AQUI
    
    // Converter data para display
    let dataDisplay = args.data || 'hoje';
    if (args.data === 'hoje') {
        const hoje = new Date();
        dataDisplay = hoje.toLocaleDateString('pt-BR');
    } else if (args.data === 'amanhã' || args.data === 'amanha' || args.data === 'tomorrow') {
        const amanha = new Date();
        amanha.setDate(amanha.getDate() + 1);
        dataDisplay = amanha.toLocaleDateString('pt-BR');
    } else if (args.data && args.data.includes('-')) {
        const [dia, mes, ano] = args.data.split('-');
        dataDisplay = `${dia}/${mes}/${ano}`;
    }
    
    const iconEmoji = ICON_EMOJI_MAP[args.iconChc] || ICON_EMOJI_MAP[1] || '📝';
    const corHex = CORES_MAP[args.cor?.toLowerCase()] || args.cor || '#ffffa5';
    
    // Badge se houver múltiplos
    const badgeHtml = total > 1 ? 
        `<span style="background: #2196f3; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px; margin-left: 10px;">
            ${index}/${total}
        </span>` : '';
    
    messageDiv.innerHTML = `
        <div style="margin-bottom: 15px; display: flex; align-items: center;">
            <strong>🤖 Assistente sugeriu ${badgeHtml}:</strong>
        </div>
        <div>${aiMessage}</div>
        
        <div class="post-it-preview" style="
            background: ${corHex}; 
            color: ${args.textColor === 'branco' ? '#ffffff' : '#000000'};
            padding: 15px;
            border-radius: 10px;
            margin: 10px 0;
            border: 2px dashed ${args.textColor === 'branco' ? '#fff' : '#000'};
            box-shadow: 0 3px 10px rgba(0,0,0,0.1);
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 style="margin: 0; border-bottom: 2px solid ${args.textColor === 'branco' ? '#fff' : '#000'}; 
                           padding-bottom: 5px; font-size: 16px;">
                    ${args.titulo || 'Sem título'}
                </h4>
                <span style="font-size: 24px;">${iconEmoji}</span>
            </div>
            <p style="margin: 10px 0; font-size: 14px; line-height: 1.4;">${args.descricao || 'Sem descrição'}</p>
            <div style="font-size: 12px; opacity: 0.8; margin-top: 15px; padding-top: 10px; border-top: 1px dashed ${args.textColor === 'branco' ? '#fff' : '#000'}20;">
                📅 <strong>Data:</strong> ${dataDisplay}<br>
                🎨 <strong>Cor:</strong> ${args.cor || 'amarelo'}<br>
                🔤 <strong>Texto:</strong> ${args.textColor || 'preto'}
            </div>
        </div>
        
        <div class="confirmation-buttons" style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
            <!-- BOTÃO 1: CRIAR ESTE POST-IT -->
            <button class="btn-criar-este" 
                    style="background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 5px; 
                           cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 5px;">
                ✅ Criar Este
            </button>
            
            <!-- BOTÃO 2: CRIAR TODOS (apenas se houver múltiplos) -->
            ${total > 1 && allPostIts ? `
                <button class="btn-criar-todos" 
                        style="background: #2196f3; color: white; border: none; padding: 8px 16px; border-radius: 5px; 
                               cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 5px;">
                    ✅ Criar Todos (${total})
                </button>
            ` : ''}
            
            <!-- BOTÃO 3: EDITAR -->
            <button class="btn-editar" 
                    style="background: #FF9800; color: white; border: none; padding: 8px 16px; border-radius: 5px; 
                           cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 5px;">
                ✏️ Editar
            </button>
            
            <!-- BOTÃO 4: CANCELAR -->
            <button class="btn-cancelar" 
                    style="background: #f44336; color: white; border: none; padding: 8px 16px; border-radius: 5px; 
                           cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 5px;">
                ❌ Cancelar
            </button>
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Adiciona os event listeners
    const btnCriarEste = messageDiv.querySelector('.btn-criar-este');
    if (btnCriarEste) {
        btnCriarEste.addEventListener('click', function() {
            console.log('🎯 Botão "Criar Este" clicado!');
            console.log('📦 Dados do post-it:', args);
            
            // Mostra que está processando
            btnCriarEste.innerHTML = '⏳ Criando...';
            btnCriarEste.disabled = true;
            btnCriarEste.style.background = '#999';
            
            // Chama a função
            createPostItFromAI(args);
        });
    }
    
    // Botão "Criar Todos" (se existir)
    const btnCriarTodos = messageDiv.querySelector('.btn-criar-todos');
    if (btnCriarTodos && allPostIts) {
        btnCriarTodos.addEventListener('click', function() {
            console.log('🎯 Botão "Criar Todos" clicado!');
            console.log('📦 Todos os post-its:', allPostIts);
            
            btnCriarTodos.innerHTML = '⏳ Criando todos...';
            btnCriarTodos.disabled = true;
            btnCriarTodos.style.background = '#999';
            
            createAllPostIts(allPostIts);
        });
    }
    
    // Botão "Editar"
    const btnEditar = messageDiv.querySelector('.btn-editar');
    if (btnEditar) {
        btnEditar.addEventListener('click', function() {
            console.log('✏️ Botão "Editar" clicado');
            editPostItBeforeCreate(args);
        });
    }
    
    // Botão "Cancelar"
    const btnCancelar = messageDiv.querySelector('.btn-cancelar');
    if (btnCancelar) {
        btnCancelar.addEventListener('click', function() {
            console.log('❌ Botão "Cancelar" clicado');
            messageDiv.remove();
        });
    }
}

// FUNÇÃO CORRIGIDA PARA CRIAR POST-IT DA IA
function createPostItFromAI(args) {
    console.log('🎯 FUNÇÃO createPostItFromAI INICIADA');
    
    // 1. VALIDAÇÃO BÁSICA
    if (!args || typeof args !== 'object') {
        console.error('❌ ERRO: Argumentos inválidos');
        Swal.fire('Erro', 'Dados inválidos recebidos', 'error');
        return false;
    }
    
    // 2. DADOS BÁSICOS (com fallbacks)
    const titulo = args.titulo || 'Tarefa ' + new Date().toLocaleTimeString();
    const descricao = args.descricao || 'Criado pelo assistente IA';
    
    console.log('📝 Dados recebidos:', { titulo, descricao, ...args });
    
    // 3. PREPARA DATA - CORREÇÃO IMPORTANTE!
    let dataFinal;
    
    // Primeiro, tenta usar a data como foi fornecida
    if (args.data) {
        // Se a IA enviou uma data específica como string
        if (typeof args.data === 'string') {
            // Remove espaços extras e converte para minúsculas
            const dataStr = args.data.trim().toLowerCase();
            
            // Verifica se são palavras-chave especiais
            if (dataStr === 'amanhã' || dataStr === 'amanha' || dataStr === 'tomorrow') {
                const amanha = new Date();
                amanha.setDate(amanha.getDate() + 1);
                amanha.setHours(12, 0, 0); // Meio-dia de amanhã
                dataFinal = amanha.toISOString();
                console.log('📅 Data processada: amanhã ->', dataFinal);
                
            } else if (dataStr === 'hoje' || dataStr === 'today') {
                const hoje = new Date();
                hoje.setHours(18, 0, 0); // 18h de hoje
                dataFinal = hoje.toISOString();
                console.log('📅 Data processada: hoje ->', dataFinal);
                
            } else if (dataStr === 'próxima semana' || dataStr === 'proxima semana' || dataStr === 'next week') {
                const proximaSemana = new Date();
                proximaSemana.setDate(proximaSemana.getDate() + 7);
                proximaSemana.setHours(12, 0, 0);
                dataFinal = proximaSemana.toISOString();
                console.log('📅 Data processada: próxima semana ->', dataFinal);
                
            } else {
                // Tenta parsear como uma data específica
                try {
                    // Remove palavras extras
                    const cleanDateStr = dataStr
                        .replace('às', '')
                        .replace('as', '')
                        .replace('hora', '')
                        .replace('horas', '')
                        .replace('h', '')
                        .trim();
                    
                    // Tenta vários formatos de data
                    let dateObj;
                    
                    // Formato DD/MM/YYYY ou DD/MM/YY
                    if (cleanDateStr.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
                        const parts = cleanDateStr.split('/');
                        const day = parseInt(parts[0]);
                        const month = parseInt(parts[1]) - 1; // Mês em JS é 0-indexed
                        const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
                        
                        dateObj = new Date(year, month, day, 12, 0, 0);
                        console.log('📅 Parseado formato DD/MM/YYYY:', cleanDateStr, '->', dateObj);
                        
                    } 
                    // Formato YYYY-MM-DD (ISO)
                    else if (cleanDateStr.match(/\d{4}-\d{1,2}-\d{1,2}/)) {
                        dateObj = new Date(cleanDateStr + 'T12:00:00');
                        console.log('📅 Parseado formato YYYY-MM-DD:', cleanDateStr, '->', dateObj);
                        
                    }
                    // Formato com dia da semana
                    else if (cleanDateStr.includes('segunda') || cleanDateStr.includes('monday')) {
                        dateObj = getNextWeekday(1); // Segunda-feira
                    } else if (cleanDateStr.includes('terça') || cleanDateStr.includes('tuesday')) {
                        dateObj = getNextWeekday(2); // Terça-feira
                    } else if (cleanDateStr.includes('quarta') || cleanDateStr.includes('wednesday')) {
                        dateObj = getNextWeekday(3); // Quarta-feira
                    } else if (cleanDateStr.includes('quinta') || cleanDateStr.includes('thursday')) {
                        dateObj = getNextWeekday(4); // Quinta-feira
                    } else if (cleanDateStr.includes('sexta') || cleanDateStr.includes('friday')) {
                        dateObj = getNextWeekday(5); // Sexta-feira
                    } else if (cleanDateStr.includes('sábado') || cleanDateStr.includes('saturday')) {
                        dateObj = getNextWeekday(6); // Sábado
                    } else if (cleanDateStr.includes('domingo') || cleanDateStr.includes('sunday')) {
                        dateObj = getNextWeekday(0); // Domingo
                    }
                    // Tenta parsear com Date nativo
                    else {
                        dateObj = new Date(cleanDateStr);
                        if (isNaN(dateObj.getTime())) {
                            // Se ainda não conseguiu, tenta adicionar o ano atual
                            dateObj = new Date(cleanDateStr + ' ' + new Date().getFullYear());
                        }
                    }
                    
                    // Verifica se a data é válida
                    if (dateObj && !isNaN(dateObj.getTime())) {
                        // Se não tem hora específica, adiciona 12:00
                        if (dateObj.getHours() === 0 && dateObj.getMinutes() === 0) {
                            dateObj.setHours(12, 0, 0);
                        }
                        
                        dataFinal = dateObj.toISOString();
                        console.log('✅ Data parseada com sucesso:', dataFinal);
                    } else {
                        throw new Error('Data inválida');
                    }
                    
                } catch (dateError) {
                    console.warn('⚠️ Não conseguiu parsear data, usando amanhã como fallback:', dateError);
                    // Fallback para amanhã
                    const amanha = new Date();
                    amanha.setDate(amanha.getDate() + 1);
                    amanha.setHours(12, 0, 0);
                    dataFinal = amanha.toISOString();
                }
            }
        } 
        // Se a IA já enviou um objeto Date ou timestamp
        else if (args.data instanceof Date) {
            dataFinal = args.data.toISOString();
        } else if (typeof args.data === 'number') {
            dataFinal = new Date(args.data).toISOString();
        }
    } 
    
    // Se não foi fornecida data OU não conseguiu processar, usa padrão inteligente
    if (!dataFinal) {
        // Tenta extrair data do título ou descrição
        const extractedDate = extractDateFromText(titulo + ' ' + descricao);
        if (extractedDate) {
            dataFinal = extractedDate.toISOString();
            console.log('📅 Data extraída do texto:', dataFinal);
        } else {
            // Padrão: 2 dias a partir de agora
            const padrao = new Date();
            padrao.setDate(padrao.getDate() + 2);
            padrao.setHours(12, 0, 0);
            dataFinal = padrao.toISOString();
            console.log('📅 Usando data padrão (2 dias):', dataFinal);
        }
    }
    
    // Função auxiliar para obter próximo dia da semana
    function getNextWeekday(targetDay) {
        const today = new Date();
        const currentDay = today.getDay();
        const daysUntilTarget = (targetDay + 7 - currentDay) % 7;
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));
        nextDate.setHours(12, 0, 0);
        return nextDate;
    }
    
    // Função auxiliar para extrair data do texto
    function extractDateFromText(text) {
        const lowerText = text.toLowerCase();
        
        // Procura por padrões comuns
        const patterns = [
            // Hoje/amanhã/etc
            { regex: /(hoje|today)/, offset: 0 },
            { regex: /(amanhã|amanha|tomorrow)/, offset: 1 },
            { regex: /(depois de amanhã|day after tomorrow)/, offset: 2 },
            { regex: /(próxima semana|proxima semana|next week)/, offset: 7 },
            
            // Dias da semana
            { regex: /(segunda|monday)/, weekday: 1 },
            { regex: /(terça|terca|tuesday)/, weekday: 2 },
            { regex: /(quarta|wednesday)/, weekday: 3 },
            { regex: /(quinta|thursday)/, weekday: 4 },
            { regex: /(sexta|friday)/, weekday: 5 },
            { regex: /(sábado|sabado|saturday)/, weekday: 6 },
            { regex: /(domingo|sunday)/, weekday: 0 },
            
            // Datas numéricas
            { regex: /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/, parse: (match) => {
                const day = parseInt(match[1]);
                const month = parseInt(match[2]) - 1;
                const year = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3]);
                return new Date(year, month, day, 12, 0, 0);
            }}
        ];
        
        for (const pattern of patterns) {
            const match = lowerText.match(pattern.regex);
            if (match) {
                if (pattern.offset !== undefined) {
                    const date = new Date();
                    date.setDate(date.getDate() + pattern.offset);
                    date.setHours(12, 0, 0);
                    return date;
                } else if (pattern.weekday !== undefined) {
                    return getNextWeekday(pattern.weekday);
                } else if (pattern.parse) {
                    return pattern.parse(match);
                }
            }
        }
        
        return null;
    }
    
    // 4. PREPARA CORES
    const corMap = {
        'amarelo': '#ffffa5', 'vermelho': '#ffcccc', 'verde': '#ccffcc',
        'azul': '#cce5ff', 'roxo': '#e6ccff', 'rosa': '#ffccf9',
        'laranja': '#ffddcc', 'cinza': '#f0f0f0',
        'yellow': '#ffffa5', 'red': '#ffcccc', 'green': '#ccffcc',
        'blue': '#cce5ff', 'purple': '#e6ccff', 'pink': '#ffccf9',
        'orange': '#ffddcc', 'gray': '#f0f0f0'
    };
    
    const corFinal = args.cor ? (corMap[args.cor.toLowerCase()] || args.cor) : '#ffffa5';
    const corTxtFinal = (args.textColor === 'branco' || args.textColor === 'white') ? '#ffffff' : '#000000';
    
    // 5. ÍCONE
    let iconEscolhaFinal = '1';
    if (args.iconChc) {
        const iconNum = parseInt(args.iconChc);
        if (!isNaN(iconNum) && iconNum >= 1 && iconNum <= 10) {
            iconEscolhaFinal = iconNum.toString();
        } else {
            // Tenta inferir ícone baseado no conteúdo
            const lowerTitulo = titulo.toLowerCase();
            if (lowerTitulo.includes('estud') || lowerTitulo.includes('ler') || lowerTitulo.includes('curso')) {
                iconEscolhaFinal = '5'; // 📚
            } else if (lowerTitulo.includes('urgent') || lowerTitulo.includes('importante') || lowerTitulo.includes('prioridade')) {
                iconEscolhaFinal = '3'; // ⚠️
            } else if (lowerTitulo.includes('meta') || lowerTitulo.includes('objetivo') || lowerTitulo.includes('goal')) {
                iconEscolhaFinal = '4'; // 🎯
            }
        }
    }
    
    // 6. GERA ID ÚNICO
    const postId = 'ai_postit_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    // 7. CRIA OBJETO COMPLETO
    const postItData = {
        id: postId,
        data: dataFinal,
        titulo: titulo,
        descricao: descricao,
        cor: corFinal,
        corTxt: corTxtFinal,
        iconEscolha: iconEscolhaFinal
    };
    
    console.log('📦 Objeto completo final:', postItData);
    
    // 8. SALVA NO LOCALSTORAGE
    try {
        console.log('💾 Salvando no localStorage...');
        
        // Pega dados existentes ou cria array vazio
        let dadosExistentes = [];
        const dadosString = localStorage.getItem("Dados");
        
        if (dadosString) {
            try {
                dadosExistentes = JSON.parse(dadosString);
                if (!Array.isArray(dadosExistentes)) {
                    console.warn('⚠️ Dados não eram array, recriando...');
                    dadosExistentes = [];
                }
            } catch (parseError) {
                console.warn('⚠️ Erro ao parsear, recriando array:', parseError);
                dadosExistentes = [];
            }
        }
        
        console.log('📊 Dados existentes:', dadosExistentes.length);
        
        // Adiciona novo item
        dadosExistentes.push(postItData);
        
        // Salva
        localStorage.setItem("Dados", JSON.stringify(dadosExistentes));
        console.log('✅ Dados salvos no localStorage');
        
    } catch (storageError) {
        console.error('💥 ERRO NO LOCALSTORAGE:', storageError);
        Swal.fire('ERRO', 'Não foi possível salvar no armazenamento.', 'error');
        return false;
    }
    
    // 9. CRIA VISUALMENTE
    try {
        console.log('🎨 Criando visualmente...');
        
        // Chama a função principal
        adicionarOuAtualizarPostIt(
            postItData.data,
            postItData.titulo,
            postItData.descricao,
            postItData.cor,
            postItData.corTxt,
            parseInt(postItData.iconEscolha),
            null,
            postItData.id
        );
        
        console.log('✅ Post-it criado visualmente');
        
    } catch (visualError) {
        console.warn('⚠️ Erro na criação visual:', visualError);
        // Continua mesmo assim - o importante é que salvou no localStorage
    }
    
    // 10. FEEDBACK FINAL
    console.log('🎉 PROCESSO COMPLETO COM SUCESSO!');
    
    // Atualiza botão se existir
    const btnCriar = document.querySelector('.btn-criar-este');
    if (btnCriar) {
        btnCriar.innerHTML = '✅ Criado!';
        btnCriar.style.background = '#4CAF50';
        btnCriar.disabled = true;
    }
    
    // Mensagem para usuário
    setTimeout(() => {
        Swal.fire({
            icon: 'success',
            title: '✅ Post-it Criado!',
            text: `"${titulo}" foi salvo para ${new Date(dataFinal).toLocaleDateString('pt-BR')}.`,
            timer: 2000,
            showConfirmButton: false
        });
    }, 300);
    
    return true;
}
// Função para criar múltiplos post-its
function createAllPostIts(postItsArray) {
    if (!postItsArray || !Array.isArray(postItsArray)) {
        console.error('Array de post-its inválido:', postItsArray);
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: 'Dados inválidos para criar post-its.',
            timer: 2000
        });
        return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    // Desabilita botões durante o processo
    document.querySelectorAll('.confirmation-buttons button').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.6';
    });
    
    // Processa cada post-it
    postItsArray.forEach((postItArgs, index) => {
        try {
            // Chama a função existente
            createPostItFromAI(postItArgs);
            successCount++;
            
            // Atualiza visual do item específico
            const messageDiv = document.querySelector(`[data-postit-index="${index + 1}"]`);
            if (messageDiv) {
                const buttonsDiv = messageDiv.querySelector('.confirmation-buttons');
                if (buttonsDiv) {
                    buttonsDiv.innerHTML = `
                        <span style="color: #4CAF50; font-weight: bold; display: flex; align-items: center; gap: 8px;">
                            ✅ Criado
                        </span>
                    `;
                }
            }
            
        } catch (error) {
            console.error(`Erro ao criar post-it ${index + 1}:`, error);
            errorCount++;
            
            // Mostra erro no item específico
            const messageDiv = document.querySelector(`[data-postit-index="${index + 1}"]`);
            if (messageDiv) {
                const buttonsDiv = messageDiv.querySelector('.confirmation-buttons');
                if (buttonsDiv) {
                    buttonsDiv.innerHTML = `
                        <span style="color: #f44336; font-weight: bold;">
                            ❌ Erro
                        </span>
                    `;
                }
            }
        }
    });
    
    // Feedback final
    setTimeout(() => {
        Swal.fire({
            icon: successCount > 0 ? 'success' : 'error',
            title: successCount > 0 ? 'Concluído!' : 'Ops...',
            html: `
                <strong>${successCount} post-it(s) criados com sucesso!</strong>
                ${errorCount > 0 ? `<br><small>${errorCount} não foram criados.</small>` : ''}
            `,
            timer: 3000
        });
        
        // Reabilita botões
        document.querySelectorAll('.confirmation-buttons button').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });
        
    }, 500);
}

// Função para editar antes de criar
function editPostItBeforeCreate(args) {
    // Abre o modal de edição existente
    alerta();
    
    // Preenche os campos após um pequeno delay para garantir que o modal está aberto
    setTimeout(() => {
        const modalTitulo = document.getElementById('nome');
        const modalDescricao = document.getElementById('descricao');
        const modalData = document.getElementById('date');
        
        if (modalTitulo) modalTitulo.value = args.titulo || '';
        if (modalDescricao) modalDescricao.value = args.descricao || '';
        
        // Processa data especial
        if (modalData) {
            if (args.data === 'hoje' || args.data === 'today') {
                const hoje = new Date();
                hoje.setHours(23, 59, 0);
                modalData.value = hoje.toISOString().slice(0, 16);
            } else if (args.data === 'amanhã' || args.data === 'amanha' || args.data === 'tomorrow') {
                const amanha = new Date();
                amanha.setDate(amanha.getDate() + 1);
                amanha.setHours(23, 59, 0);
                modalData.value = amanha.toISOString().slice(0, 16);
            } else {
                modalData.value = args.data || '';
            }
        }
        
        // Foca no primeiro campo
        if (modalTitulo) modalTitulo.focus();
    }, 100);
}

// Event Listeners do Chat
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

// Auto-expand após alguns segundos (opcional)
setTimeout(() => {
    if (!isExpanded) {
        expandChat();
    }
}, 3000);