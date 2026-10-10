const SUPABASE_URL = "https://doecoosuqibzdsyadsyg.supabase.co";
const SUPABASE_KEY = "sb_publishable_-30z4xAhwJPYmy1bfSEjCw_loKUe8uL";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const precosServicosTabela = {
    "Corte de Cabelo": 35.00, "Barba Completa": 35.00, "Combo Cabelo + Barba": 70.00,
    "Sobrancelha": 15.00, "Pigmentação": 35.00, "Alisamento": 35.00, "Hidratação": 35.00,
    "Selagem": 70.00, "Luzes": 90.00, "Platinado": 120.00
};

let usuarioLogado = "";
let offsetSemana = 0;
let modoMensalistaAtivo = false;

function renderizarSeletorServicos(containerId, classeCheckbox, callbackMudanca) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = "";
    container.className = "servicos-selector-grid";

    Object.keys(precosServicosTabela).forEach(serv => {
        const preco = precosServicosTabela[serv];
        
        const pill = document.createElement("div");
        pill.className = "servico-pill";
        pill.innerHTML = `
            <span class="nome"><i class="fa-regular fa-square"></i> ${serv}</span>
            <span class="valor">R$ ${preco.toFixed(2).replace(".", ",")}</span>
            <input type="checkbox" class="${classeCheckbox}" value="${serv}" data-preco="${preco}" style="display: none;">
        `;

        pill.onclick = () => {
            const chk = pill.querySelector("input");
            chk.checked = !chk.checked;
            const icon = pill.querySelector("i");
            if (chk.checked) {
                pill.classList.add("selected");
                icon.className = "fa-solid fa-square-check";
            } else {
                pill.classList.remove("selected");
                icon.className = "fa-regular fa-square";
            }
            if (callbackMudanca) callbackMudanca();
        };

        container.appendChild(pill);
    });
}

function mostrarAlerta(mensagem, sucesso = true) {
    const tituloEl = document.getElementById("alerta-titulo");
    if (!tituloEl) return;
    tituloEl.textContent = sucesso ? "Sucesso!" : "Aviso!";
    document.getElementById("alerta-mensagem").textContent = mensagem;
    document.getElementById("modal-alerta").classList.add("active");
}

function fecharAlerta() {
    document.getElementById("modal-alerta").classList.remove("active");
}

function diaDaSemana(dateString) {
    const [y, m, d] = dateString.split("-").map(Number);
    return new Date(y, m - 1, d).getDay();
}

function obterHorariosParaData(dataString) {
    if (!dataString) return [];
    const diaSem = diaDaSemana(dataString);
    if (diaSem === 0 || diaSem === 1) return []; // Fechado Dom e Seg

    let horarios = [];
    let horaInicio = 5; // Padrão iniciando às 05:00 para emergências matinais
    let horaFim = 21;
    let currentMin = Math.round(horaInicio * 60);
    let endMin = horaFim * 60;
    
    while (currentMin <= endMin) {
        let h = Math.floor(currentMin / 60);
        let m = currentMin % 60;
        horarios.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        currentMin += 40; 
    }
    return horarios;
}

function fazerLogin() {
    const usuarioInput = document.getElementById("login-usuario").value.trim().toLowerCase();
    const senhaInput = document.getElementById("login-senha").value.trim();

    if (!usuarioInput || !senhaInput) {
        mostrarAlerta("Preencha o login e a senha.", false);
        return;
    }

    if (usuarioInput === 'willian' && senhaInput === 'willian123') {
        usuarioLogado = "Willian";
        document.getElementById("login-section").style.display = "none";
        document.getElementById("dashboard-barbeiro").style.display = "block";
        offsetSemana = 0;
        carregarAgendaSemanal();
    } else if (usuarioInput === 'admin' && senhaInput === 'admin123') {
        usuarioLogado = "Admin";
        document.getElementById("login-section").style.display = "none";
        document.getElementById("dashboard-admin").style.display = "block";
        carregarResumoAdmin();
    } else {
        mostrarAlerta("Login ou senha incorretos!", false);
    }
}

function fazerLogout() {
    usuarioLogado = "";
    document.getElementById("dashboard-barbeiro").style.display = "none";
    document.getElementById("dashboard-admin").style.display = "none";
    document.getElementById("login-section").style.display = "block";
}

function mudarSemana(direcao) {
    offsetSemana += direcao;
    carregarAgendaSemanal();
}

function obterDiasDaSemana(offset) {
    const dias = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); 
    const diaSemana = hoje.getDay();
    const diffParaSegunda = (diaSemana === 0 ? -6 : 1) - diaSemana + (offset * 7);
    const segunda = new Date(hoje);
    segunda.setDate(hoje.getDate() + diffParaSegunda);

    for (let i = 0; i < 6; i++) { 
        const d = new Date(segunda);
        d.setDate(segunda.getDate() + i);
        const isoString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const formatada = d.toLocaleDateString("pt-BR", { weekday: 'short', day: '2-digit', month: '2-digit' });
        dias.push({ iso: isoString, label: formatada });
    }
    return dias;
}

async function carregarAgendaSemanal() {
    const container = document.getElementById("grade-semanal-container");
    const lblPeriodo = document.getElementById("label-periodo-semana");
    if (!container) return;
    
    container.innerHTML = "<p style='color: #666; text-align: center; width: 100%; font-size: 0.7rem;'>A carregar...</p>";

    const diasSemana = obterDiasDaSemana(offsetSemana);
    lblPeriodo.textContent = `${diasSemana[0].label} até ${diasSemana[5].label}`;

    try {
        const { data: agendamentos } = await _supabase.from("agendamentos").select("*").eq("barbeiro", usuarioLogado).gte("data", diasSemana[0].iso).lte("data", diasSemana[5].iso);
        const { data: bloqueios } = await _supabase.from("bloqueios_agenda").select("*").eq("barbeiro", usuarioLogado).gte("data", diasSemana[0].iso).lte("data", diasSemana[5].iso);

        let qtdConcluidos = 0;
        let qtdEncaixes = 0;
        let faturamentoTotal = 0;

        (agendamentos || []).forEach(a => {
            if (a.status === 'concluido') {
                qtdConcluidos++;
                faturamentoTotal += Number(a.preco_total || 35);
            }
            if (a.servico && a.servico.includes("[ENCAIXE]")) {
                qtdEncaixes++;
            }
        });

        document.getElementById("barber-total-atendidos").textContent = qtdConcluidos;
        document.getElementById("barber-total-encaixes").textContent = qtdEncaixes;
        document.getElementById("barber-total-faturamento").textContent = `R$ ${faturamentoTotal.toFixed(2).replace(".", ",")}`;

        container.innerHTML = "";

        diasSemana.forEach(dia => {
            const coluna = document.createElement("div");
            coluna.className = "day-column";
            const blqDia = (bloqueios || []).find(b => b.data === dia.iso && b.horario === 'TODOS');
            
            coluna.innerHTML = `
                <div class="day-header">
                    <span>${dia.label}</span>
                    <button onclick="alternarBloqueioDia('${dia.iso}', ${!!blqDia})" style="background: ${blqDia ? '#FFF5F5' : '#FFF'}; color: ${blqDia ? '#e74c3c' : '#000'}; border: 1px solid ${blqDia ? '#e74c3c' : '#CCC'}; padding: 1px 2px; border-radius: 2px; font-size: 0.5rem; cursor: pointer;">
                        ${blqDia ? 'Desbl' : 'Bloq'}
                    </button>
                </div>
            `;

            const slotsDiv = document.createElement("div");
            slotsDiv.style.cssText = "display: flex; flex-direction: column; gap: 3px;";

            if (blqDia) {
                slotsDiv.innerHTML = `<div style="color: #e74c3c; text-align: center; font-size: 0.55rem; padding: 10px 0; font-weight: bold;">Bloq</div>`;
            } else {
                const horariosDia = obterHorariosParaData(dia.iso);
                const agendamentosDia = (agendamentos || []).filter(a => a.data === dia.iso && a.status !== 'cancelado');
                const bloqueiosDia = (bloqueios || []).filter(b => b.data === dia.iso && b.horario !== 'TODOS');
                
                let itensRenderizacao = [];

                horariosDia.forEach(h => {
                    let agsNoHorario = agendamentosDia.filter(a => String(a.horario).substring(0, 5) === h);
                    let blq = bloqueiosDia.find(b => String(b.horario).substring(0, 5) === h);

                    if (agsNoHorario.length > 0) {
                        agsNoHorario.forEach(ag => itensRenderizacao.push({ tipo: 'agendamento', horario: h, dado: ag }));
                    } else if (blq) {
                        itensRenderizacao.push({ tipo: 'bloqueio', horario: h, dado: blq });
                    } else {
                        itensRenderizacao.push({ tipo: 'vazio', horario: h });
                    }
                });

                agendamentosDia.forEach(a => {
                    const horaA = String(a.horario).substring(0, 5);
                    if (!horariosDia.includes(horaA)) {
                        itensRenderizacao.push({ tipo: 'agendamento', horario: horaA, dado: a });
                    }
                });

                itensRenderizacao.sort((a, b) => a.horario.localeCompare(b.horario));

                itensRenderizacao.forEach(item => {
                    const itemSlot = document.createElement("div");

                    if (item.tipo === 'bloqueio') {
                        itemSlot.className = "slot-item blocked";
                        itemSlot.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight:bold;">${item.horario}</span>
                                <button onclick="alternarBloqueioHorario('${dia.iso}', '${item.horario}', true)" style="background: #FFF5F5; color: #e74c3c; border: 1px solid #e74c3c; padding: 1px; font-size: 0.45rem; cursor: pointer;">X</button>
                            </div>
                        `;
                    } else if (item.tipo === 'agendamento') {
                        const ag = item.dado;
                        const isConcluido = ag.status === 'concluido';
                        const isEncaixe = ag.servico && ag.servico.includes("[ENCAIXE]");
                        const isMensalista = ag.recorrente === true || (ag.servico && ag.servico.includes("[MENSALISTA]"));
                        
                        if (isMensalista) {
                            itemSlot.className = "slot-item mensalista";
                        } else {
                            itemSlot.className = isConcluido ? "slot-item concluded" : "slot-item booked";
                        }

                        itemSlot.onclick = () => abrirGerenciadorAgendamento(ag.id);
                        itemSlot.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight:bold;">${item.horario}</span>
                                <span style="font-size: 0.5rem; color: ${isMensalista ? '#9b59b6' : (isConcluido ? '#3498db' : '#25D366')}; font-weight: bold;">
                                    ${isMensalista ? 'M' : (isConcluido ? 'P' : (isEncaixe ? 'ENC' : 'C'))}
                                </span>
                            </div>
                            <div style="font-weight: 600; color: #000; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${ag.cliente}">
                                ${ag.cliente}
                            </div>
                        `;
                    } else {
                        itemSlot.className = "slot-item available";
                        itemSlot.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <span style="color:#666;">${item.horario}</span>
                                <button onclick="alternarBloqueioHorario('${dia.iso}', '${item.horario}', false)" style="background: #FFF; color: #000; border: 1px solid #CCC; padding: 0px 2px; font-size: 0.45rem; cursor: pointer;">Bloq</button>
                            </div>
                        `;
                    }
                    slotsDiv.appendChild(itemSlot);
                });
            }
            coluna.appendChild(slotsDiv);
            container.appendChild(coluna);
        });
    } catch (err) {
        console.error("Erro agenda:", err);
    }
}

async function alternarBloqueioDia(dataIso, estaBloqueado) {
    try {
        if (estaBloqueado) {
            await _supabase.from("bloqueios_agenda").delete().eq("barbeiro", usuarioLogado).eq("data", dataIso).eq("horario", "TODOS");
        } else {
            await _supabase.from("bloqueios_agenda").insert([{ barbeiro: usuarioLogado, data: dataIso, horario: "TODOS", tipo: "dia_todo" }]);
        }
        carregarAgendaSemanal();
    } catch (err) {
        mostrarAlerta("Erro ao alterar bloqueio.", false);
    }
}

async function alternarBloqueioHorario(dataIso, horario, estaBloqueado) {
    try {
        if (estaBloqueado) {
            await _supabase.from("bloqueios_agenda").delete().eq("barbeiro", usuarioLogado).eq("data", dataIso).eq("horario", horario);
        } else {
            await _supabase.from("bloqueios_agenda").insert([{ barbeiro: usuarioLogado, data: dataIso, horario: horario, tipo: "horario" }]);
        }
        carregarAgendaSemanal();
    } catch (err) {
        mostrarAlerta("Erro ao alterar bloqueio.", false);
    }
}

function abrirModalAgendamentoManual() {
    modoMensalistaAtivo = false;
    document.getElementById("titulo-modal-manual").textContent = "Agendamento Avulso";
    document.getElementById("bloco-mensalista-opcoes").style.display = "none";
    document.getElementById("bloco-encaixe-check").style.display = "block";

    const hoje = new Date();
    document.getElementById("manual-data").value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    document.getElementById("manual-cliente").value = "";
    document.getElementById("manual-telefone").value = "";
    document.getElementById("manual-encaixe").checked = false;
    
    document.getElementById("container-input-horario").innerHTML = `<select id="manual-horario"><option value="">Selecione a data primeiro</option></select>`;
    document.getElementById("label-horario-manual").textContent = "Horário:";

    renderizarSeletorServicos("manual-servicos-container", "manual-servico-chk", () => {
        if (!document.getElementById("manual-encaixe").checked) atualizarHorariosManuaisDisponiveis();
    });

    atualizarHorariosManuaisDisponiveis();
    document.getElementById("modal-agendamento-manual").classList.add("active");
}

// GERENCIAMENTO DO MODAL DE MENSALISTAS (Lista + Cadastro)
async function abrirModalMensalista() {
    const modalMensalista = document.getElementById("modal-gerenciar-mensalistas");
    if (!modalMensalista) return;

    modalMensalista.classList.add("active");
    carregarListaMensalistasAtivos();
}

function fecharModalMensalistas() {
    document.getElementById("modal-gerenciar-mensalistas").classList.remove("active");
}

function abrirFormNovoMensalista() {
    fecharModalMensalistas();
    modoMensalistaAtivo = true;
    document.getElementById("titulo-modal-manual").textContent = "Cadastrar Mensalista";
    document.getElementById("bloco-mensalista-opcoes").style.display = "block";
    document.getElementById("bloco-encaixe-check").style.display = "none";

    const hoje = new Date();
    document.getElementById("manual-data").value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    document.getElementById("manual-cliente").value = "";
    document.getElementById("manual-telefone").value = "";

    document.getElementById("label-horario-manual").textContent = "Horário Fixo:";
    document.getElementById("container-input-horario").innerHTML = `<input type="time" id="manual-horario" value="10:00" style="width: 100%; padding: 10px; background: #FFF; border: 1px solid #9b59b6; border-radius: 6px;">`;

    renderizarSeletorServicos("manual-servicos-container", "manual-servico-chk", null);
    document.getElementById("modal-agendamento-manual").classList.add("active");
}

async function carregarListaMensalistasAtivos() {
    const container = document.getElementById("lista-mensalistas-container");
    if (!container) return;

    container.innerHTML = "<p style='color: #666; text-align: center;'>A carregar mensalistas...</p>";

    try {
        const { data, error } = await _supabase
            .from("agendamentos")
            .select("*")
            .eq("barbeiro", usuarioLogado)
            .eq("recorrente", true)
            .eq("status", "ativo")
            .order("data", { ascending: true });

        if (error) throw error;

        container.innerHTML = "";
        if (!data || data.length === 0) {
            container.innerHTML = "<p style='color: #666; text-align: center;'>Nenhum mensalista ativo no momento.</p>";
            return;
        }

        data.forEach(item => {
            const card = document.createElement("div");
            card.style.cssText = "background: #FAF5FF; border: 1px solid #9b59b6; border-radius: 6px; padding: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;";
            
            card.innerHTML = `
                <div>
                    <strong style="color: #000; font-size: 0.85rem;"><i class="fa-solid fa-star" style="color: #9b59b6;"></i> ${item.cliente} (${item.telefone})</strong><br>
                    <span style="font-size: 0.75rem; color: #555;">Início: ${item.data.split("-").reverse().join("/")} às ${item.horario} - R$ ${Number(item.preco_total || 35).toFixed(2).replace(".", ",")}</span>
                </div>
                <button onclick="cancelarMensalista(${item.id})" style="background: #FFF5F5; color: #e74c3c; border: 1px solid #e74c3c; padding: 6px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; cursor: pointer;">Cancelar</button>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        container.innerHTML = "<p style='color: red; text-align: center;'>Erro ao carregar mensalistas.</p>";
    }
}

async function cancelarMensalista(id) {
    if (!confirm("Deseja realmente cancelar este mensalista?")) return;
    try {
        const { error } = await _supabase.from("agendamentos").update({ status: 'cancelado' }).eq('id', id);
        if (error) throw error;
        carregarListaMensalistasAtivos();
        carregarAgendaSemanal();
    } catch (err) {
        mostrarAlerta("Erro ao cancelar mensalista.", false);
    }
}

function alternarModoEncaixe() {
    const chk = document.getElementById("manual-encaixe");
    const containerHorario = document.getElementById("container-input-horario");
    const labelHorario = document.getElementById("label-horario-manual");

    if (chk.checked) {
        labelHorario.textContent = "Horário do Encaixe (Livre):";
        containerHorario.innerHTML = `<input type="time" id="manual-horario" value="10:00" style="width: 100%; padding: 10px; background: #FFF; border: 1px solid #000; border-radius: 6px;">`;
    } else {
        labelHorario.textContent = "Horário:";
        containerHorario.innerHTML = `<select id="manual-horario"><option value="">A carregar...</option></select>`;
        atualizarHorariosManuaisDisponiveis();
    }
}

async function atualizarHorariosManuaisDisponiveis() {
    if (modoMensalistaAtivo || document.getElementById("manual-encaixe").checked) return;
    const dataSel = document.getElementById("manual-data").value;
    const horarioSelect = document.getElementById("manual-horario");
    if (!dataSel || !horarioSelect) return;

    const horarios = obterHorariosParaData(dataSel);
    horarioSelect.innerHTML = "";
    if (horarios.length === 0) {
        horarioSelect.innerHTML = "<option value=''>Fechado neste dia</option>";
        return;
    }
    horarios.forEach(h => {
        const opt = document.createElement("option");
        opt.value = h;
        opt.textContent = h;
        horarioSelect.appendChild(opt);
    });
}

function fecharModalAgendamentoManual() {
    document.getElementById("modal-agendamento-manual").classList.remove("active");
}

async function salvarAgendamentoManual(event) {
    if (event) event.preventDefault();

    const cliente = document.getElementById("manual-cliente").value.trim();
    const telefone = document.getElementById("manual-telefone").value.trim();
    const dataBaseStr = document.getElementById("manual-data").value;
    const horario = document.getElementById("manual-horario")?.value;
    const ehEncaixe = !modoMensalistaAtivo && document.getElementById("manual-encaixe").checked;

    let servicosSelecionados = [];
    let precoTotal = 0;
    document.querySelectorAll(".manual-servico-chk:checked").forEach(chk => {
        servicosSelecionados.push(chk.value);
        precoTotal += Number(chk.dataset.preco);
    });

    if (!cliente || !dataBaseStr || !horario || servicosSelecionados.length === 0) {
        mostrarAlerta("Preencha todos os campos e selecione ao menos um serviço.", false);
        return;
    }

    try {
        let agendamentosArray = [];

        if (modoMensalistaAtivo) {
            // Pega as configurações de recorrência escolhidas
            const frequenciaDias = parseInt(document.getElementById("manual-frequencia").value) || 7;
            const duracaoMeses = parseInt(document.getElementById("manual-duracao-meses").value) || 12;

            // Calcula a data limite baseado na duração escolhida (ex: 1 ano pra frente)
            let dataFim = new Date(dataBaseStr + "T00:00:00");
            dataFim.setMonth(dataFim.getMonth() + duracaoMeses);

            let dataAtual = new Date(dataBaseStr + "T00:00:00");

            // Loop para criar os agendamentos até atingir a data fim
            while (dataAtual <= dataFim) {
                let dataIso = dataAtual.toISOString().split("T")[0];
                let servicoFinal = `[MENSALISTA] ${servicosSelecionados.join(", ")}`;

                agendamentosArray.push({
                    barbeiro: usuarioLogado,
                    cliente: cliente,
                    telefone: telefone || "Balcão",
                    servico: servicoFinal,
                    preco_total: precoTotal > 0 ? precoTotal : 35,
                    data: dataIso,
                    horario: horario,
                    status: 'ativo',
                    recorrente: true
                });
                
                // Pula para a próxima data (ex: soma +15 dias ou +28 dias)
                dataAtual.setDate(dataAtual.getDate() + frequenciaDias);
            }
        } else {
            // Lógica normal para avulsos ou encaixes
            let servicoFinal = servicosSelecionados.join(", ");
            if (ehEncaixe) {
                servicoFinal = `[ENCAIXE] ${servicoFinal}`;
            }

            agendamentosArray.push({
                barbeiro: usuarioLogado,
                cliente: cliente,
                telefone: telefone || "Balcão",
                servico: servicoFinal,
                preco_total: precoTotal > 0 ? precoTotal : 35,
                data: dataBaseStr,
                horario: horario,
                status: 'ativo',
                recorrente: false
            });
        }

        // Salva tudo de uma vez no banco de dados (Batch Insert)
        const { error } = await _supabase.from("agendamentos").insert(agendamentosArray);

        if (error) throw error;

        fecharModalAgendamentoManual();
        mostrarAlerta(modoMensalistaAtivo ? "Mensalista cadastrado com sucesso para todo o período!" : "Agendamento salvo com sucesso!", true);
        carregarAgendaSemanal();
    } catch (err) {
        mostrarAlerta("Erro ao salvar: " + err.message, false);
    }
}

async function abrirGerenciadorAgendamento(id) {
    try {
        const { data } = await _supabase.from("agendamentos").select("*").eq("id", id).single();
        if (!data) return;

        const modal = document.getElementById("custom-action-modal");
        const detailsBox = document.getElementById("action-modal-details");
        const paymentBox = document.getElementById("payment-box");
        const rescheduleBox = document.getElementById("reschedule-box");
        const buttonsBox = document.getElementById("action-modal-buttons");

        const precoOriginal = Number(data.preco_total || 35);
        detailsBox.innerHTML = `
            <strong>Cliente:</strong> ${data.cliente}<br>
            <strong>Telefone:</strong> ${data.telefone || 'Não informado'}<br>
            <strong>Serviço Atual:</strong> ${data.servico}<br>
            <strong>Valor Base:</strong> R$ ${precoOriginal.toFixed(2).replace(".", ",")}<br>
            <strong>Data/Hora:</strong> ${data.data.split("-").reverse().join("/")} às ${data.horario}
        `;

        paymentBox.style.display = "none";
        rescheduleBox.style.display = "none";

        function atualizarValorTotalDinamico() {
            let acrescimo = 0;
            document.querySelectorAll(".extra-servico-chk:checked").forEach(chk => {
                acrescimo += Number(chk.dataset.preco);
            });
            const totalFinal = precoOriginal + acrescimo;
            document.getElementById("valor-total-atualizado").textContent = `R$ ${totalFinal.toFixed(2).replace(".", ",")}`;
        }

        renderizarSeletorServicos("extras-servicos-container", "extra-servico-chk", atualizarValorTotalDinamico);
        atualizarValorTotalDinamico();
        
        function renderizarBotoesPrincipais() {
            buttonsBox.innerHTML = "";

            if (data.status !== 'concluido') {
                const btnAtendido = document.createElement("button");
                btnAtendido.className = "custom-modal-btn btn-modal-atendido";
                btnAtendido.textContent = "Concluir e Confirmar Pgto";
                btnAtendido.onclick = () => {
                    paymentBox.style.display = "block";
                    rescheduleBox.style.display = "none";
                    buttonsBox.innerHTML = "";

                    const btnSalvarPg = document.createElement("button");
                    btnSalvarPg.className = "custom-modal-btn btn-modal-confirmar";
                    btnSalvarPg.textContent = "Salvar Atendimento e Pgto";
                    btnSalvarPg.onclick = async () => {
                        const formaPgto = document.getElementById("select-forma-pagamento").value;
                        let servicosList = data.servico ? data.servico.split(",").map(s => s.trim()) : [];
                        let acrescimo = 0;

                        document.querySelectorAll(".extra-servico-chk:checked").forEach(chk => {
                            const nomeServ = chk.value;
                            const pServ = Number(chk.dataset.preco);
                            if (!servicosList.includes(nomeServ)) {
                                servicosList.push(nomeServ);
                                acrescimo += pServ;
                            }
                        });

                        const novoPrecoTotal = precoOriginal + acrescimo;

                        try {
                            const { error } = await _supabase.from("agendamentos").update({ 
                                status: 'concluido', 
                                pagamentos: formaPgto,
                                servico: servicosList.join(", "),
                                preco_total: novoPrecoTotal
                            }).eq('id', data.id);

                            if (error) throw error;
                            modal.classList.remove("active");
                            carregarAgendaSemanal();
                        } catch (err) {
                            mostrarAlerta("Erro ao concluir: " + err.message, false);
                        }
                    };

                    const btnVoltar = document.createElement("button");
                    btnVoltar.className = "custom-modal-btn btn-modal-cancelar";
                    btnVoltar.textContent = "Voltar";
                    btnVoltar.onclick = () => {
                        paymentBox.style.display = "none";
                        renderizarBotoesPrincipais();
                    };

                    buttonsBox.appendChild(btnSalvarPg);
                    buttonsBox.appendChild(btnVoltar);
                };

                const btnReagendar = document.createElement("button");
                btnReagendar.className = "custom-modal-btn btn-modal-editar";
                btnReagendar.textContent = "Reagendar";
                btnReagendar.onclick = () => {
                    rescheduleBox.style.display = "block";
                    paymentBox.style.display = "none";
                    document.getElementById("new-reschedule-date").value = data.data;
                    document.getElementById("new-reschedule-time").value = data.horario;
                    buttonsBox.innerHTML = "";

                    const btnSalvarReag = document.createElement("button");
                    btnSalvarReag.className = "custom-modal-btn btn-modal-confirmar";
                    btnSalvarReag.textContent = "Confirmar Reagendamento";
                    btnSalvarReag.onclick = async () => {
                        try {
                            const { error } = await _supabase.from("agendamentos").update({ 
                                data: document.getElementById("new-reschedule-date").value, 
                                horario: document.getElementById("new-reschedule-time").value 
                            }).eq('id', data.id);

                            if (error) throw error;
                            modal.classList.remove("active");
                            carregarAgendaSemanal();
                        } catch (err) {
                            mostrarAlerta("Erro ao reagendar.", false);
                        }
                    };

                    const btnVoltarReag = document.createElement("button");
                    btnVoltarReag.className = "custom-modal-btn btn-modal-cancelar";
                    btnVoltarReag.textContent = "Voltar";
                    btnVoltarReag.onclick = () => {
                        rescheduleBox.style.display = "none";
                        renderizarBotoesPrincipais();
                    };

                    buttonsBox.appendChild(btnSalvarReag);
                    buttonsBox.appendChild(btnVoltarReag);
                };

                const btnCancelar = document.createElement("button");
                btnCancelar.className = "custom-modal-btn btn-modal-excluir";
                btnCancelar.textContent = "Cancelar Agendamento";
                btnCancelar.onclick = async () => {
                    try {
                        await _supabase.from("agendamentos").update({ status: 'cancelado' }).eq('id', data.id);
                        modal.classList.remove("active");
                        carregarAgendaSemanal();
                    } catch (err) {
                        mostrarAlerta("Erro ao cancelar.", false);
                    }
                };

                buttonsBox.appendChild(btnAtendido);
                buttonsBox.appendChild(btnReagendar);
                buttonsBox.appendChild(btnCancelar);
            }

            const btnFechar = document.createElement("button");
            btnFechar.className = "custom-modal-btn btn-modal-cancelar";
            btnFechar.textContent = "Fechar";
            btnFechar.onclick = () => modal.classList.remove("active");
            buttonsBox.appendChild(btnFechar);
        }

        renderizarBotoesPrincipais();
        modal.classList.add("active");
    } catch (err) {
        console.error(err);
    }
}

async function carregarResumoAdmin() {
    const dataFiltro = document.getElementById("filter-date-admin").value;
    const container = document.getElementById("agendamentos-list-admin");
    if (!dataFiltro || !container) return;
    
    container.innerHTML = "<p style='color: #666; text-align: center;'>A carregar...</p>";

    try {
        const { data } = await _supabase.from("agendamentos").select("*").eq("data", dataFiltro).order("horario", { ascending: true });
        container.innerHTML = "";
        const ativos = (data || []).filter(a => a.status !== 'cancelado');

        if (ativos.length === 0) {
            container.innerHTML = "<p style='color: #666; text-align: center;'>Nenhum agendamento.</p>";
            return;
        }

        ativos.forEach(item => {
            const card = document.createElement("div");
            card.style.cssText = "background: #FFF; padding: 10px; border-radius: 6px; border: 1px solid #DDD;";
            card.innerHTML = `<strong>${item.horario} - ${item.barbeiro}</strong><br>Cliente: ${item.cliente} | ${item.servico} | R$ ${item.preco_total || 35},00`;
            container.appendChild(card);
        });
    } catch (err) {
        container.innerHTML = "<p style='color: red; text-align: center;'>Erro ao carregar.</p>";
    }
}
