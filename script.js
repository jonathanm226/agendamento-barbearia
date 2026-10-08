// ==========================================
// CONFIGURAÇÕES INICIAIS E SUPABASE (WILLIAN)
// ==========================================
const SUPABASE_URL = "https://doecoosuqibzdsyadsyg.supabase.co";
const SUPABASE_KEY = "sb_publishable_-30z4xAhwJPYmy1bfSEjCw_loKUe8uL";
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const precosServicosTabela = {
    "Corte": 35.00, "Barba": 30.00, "Barba simples": 20.00, "Bigode simples": 10.00,
    "Sobrancelha": 10.00, "Hidratação profunda": 30.00, "Relaxamento": 40.00,
    "Escova": 25.00, "Luzes": 120.00, "Platinado": 150.00, "Botox (selagem)": 90.00,
    "Coloração": 100.00, "Pigmentação": 30.00, "Pezinho simples": 10.00, "Pezinho Gourmet": 15.00
};

const duracoesServicosTabela = {
    "Corte": 45, "Barba": 10, "Barba simples": 10, "Bigode simples": 5,
    "Sobrancelha": 25, "Hidratação profunda": 25, "Relaxamento": 25,
    "Escova": 30, "Luzes": 60, "Platinado": 60, "Botox (selagem)": 60,
    "Coloração": 60, "Pigmentação": 40, "Pezinho simples": 10, "Pezinho Gourmet": 20
};

let usuarioLogado = "";
let offsetSemana = 0; 

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
            <span class="nome"><i class="fa-regular fa-square uncheck-icon"></i> ${serv}</span>
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
                icon.style.color = "#FF6600";
            } else {
                pill.classList.remove("selected");
                icon.className = "fa-regular fa-square";
                icon.style.color = "";
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
    tituloEl.style.color = sucesso ? "#25D366" : "#FF6600";
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
    if (diaSem === 0 || diaSem === 1) return []; // Fechado Dom e Seg para Willian

    let horarios = [];
    let horaInicio = 8;
    let horaFim = 21;
    let currentMin = horaInicio * 60;
    let endMin = horaFim * 60;
    
    while (currentMin <= endMin) {
        let h = Math.floor(currentMin / 60);
        let m = currentMin % 60;
        horarios.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
        currentMin += 30; 
    }
    return horarios;
}

function fazerLogin() {
    const usuarioInput = document.getElementById("login-usuario").value.trim().toLowerCase();
    const senhaInput = document.getElementById("login-senha").value.trim();

    if (!usuarioInput || !senhaInput) {
        mostrarAlerta("Preencha o utilizador e a senha.", false);
        return;
    }

    const credenciais = {
        "willian": "willian123",
        "admin": "admin123"
    };

    if (credenciais[usuarioInput] && credenciais[usuarioInput] === senhaInput) {
        document.getElementById("login-usuario").value = "";
        document.getElementById("login-senha").value = "";

        if (usuarioInput === 'admin') {
            usuarioLogado = "Admin";
            document.getElementById("login-section").style.display = "none";
            document.getElementById("dashboard-barbeiro").style.display = "none";
            document.getElementById("dashboard-admin").style.display = "block";
            
            const hoje = new Date();
            document.getElementById("filter-date-admin").value = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
            carregarResumoAdmin();
        } else {
            usuarioLogado = "Willian";
            document.getElementById("login-section").style.display = "none";
            document.getElementById("dashboard-admin").style.display = "none";
            document.getElementById("dashboard-barbeiro").style.display = "block";
            document.getElementById("titulo-agenda-barbeiro").textContent = `Agenda: Willian`;
            offsetSemana = 0;
            carregarAgendaSemanal();
        }
    } else {
        mostrarAlerta("Utilizador ou senha incorretos!", false);
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
        
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const isoString = `${yyyy}-${mm}-${dd}`;
        
        const formatada = d.toLocaleDateString("pt-BR", { weekday: 'short', day: '2-digit', month: '2-digit' });
        dias.push({ iso: isoString, label: formatada });
    }
    return dias;
}

async function carregarAgendaSemanal() {
    const container = document.getElementById("grade-semanal-container");
    const lblPeriodo = document.getElementById("label-periodo-semana");
    if (!container) return;
    
    container.innerHTML = "<p style='color: #888; text-align: center; width: 100%; font-size: 0.65rem;'>A carregar...</p>";

    const diasSemana = obterDiasDaSemana(offsetSemana);
    lblPeriodo.textContent = `${diasSemana[0].label} até ${diasSemana[5].label}`;

    const agora = new Date();
    const dataHojeIso = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
    const horaAtualMinutos = agora.getHours() * 60 + agora.getMinutes();

    try {
        const primeiraData = diasSemana[0].iso;
        const ultimaData = diasSemana[5].iso;

        const { data: agendamentos } = await _supabase.from("agendamentos").select("*").ilike("barbeiro", `%${usuarioLogado}%`).gte("data", primeiraData).lte("data", ultimaData);
        const { data: bloqueios } = await _supabase.from("bloqueios_agenda").select("*").ilike("barbeiro", `%${usuarioLogado}%`).gte("data", primeiraData).lte("data", ultimaData);

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

            const blqDia = (bloqueios || []).find(b => String(b.data).substring(0, 10) === dia.iso && b.horario === 'TODOS');
            
            coluna.innerHTML = `
                <div class="day-header">
                    <span>${dia.label}</span>
                    <button type="button" onclick="event.stopPropagation(); alternarBloqueioDia('${dia.iso}', ${!!blqDia})" style="background: ${blqDia ? '#2C1A1A' : '#242424'}; color: ${blqDia ? '#e74c3c' : '#FFF'}; border: 1px solid ${blqDia ? '#e74c3c' : '#444'}; padding: 1px 2px; border-radius: 2px; font-size: 0.5rem; cursor: pointer;">
                        ${blqDia ? 'Desbl' : 'Bloq'}
                    </button>
                </div>
            `;

            const slotsDiv = document.createElement("div");
            slotsDiv.style.cssText = "display: flex; flex-direction: column; gap: 2px;";

            if (blqDia) {
                slotsDiv.innerHTML = `<div style="color: #e74c3c; text-align: center; font-size: 0.55rem; padding: 10px 0; font-weight: bold;"><i class="fa-solid fa-lock"></i></div>`;
            } else {
                const horariosDia = obterHorariosParaData(dia.iso);
                
                const agendamentosDia = (agendamentos || []).filter(a => {
                    const dataIso = String(a.data).substring(0, 10);
                    return dataIso === dia.iso && a.status !== 'cancelado';
                });

                const bloqueiosDia = (bloqueios || []).filter(b => String(b.data).substring(0, 10) === dia.iso && b.horario !== 'TODOS');
                
                let itensRenderizacao = [];

                horariosDia.forEach(h => {
                    let agsNoHorario = agendamentosDia.filter(a => String(a.horario).substring(0, 5) === h);
                    let blq = bloqueiosDia.find(b => String(b.horario).substring(0, 5) === h);

                    if (agsNoHorario.length > 0) {
                        agsNoHorario.forEach(ag => {
                            itensRenderizacao.push({ tipo: 'agendamento', horario: h, dado: ag });
                        });
                    } else if (blq) {
                        itensRenderizacao.push({ tipo: 'bloqueio', horario: h, dado: blq });
                    } else {
                        itensRenderizacao.push({ tipo: 'vazio', horario: h });
                    }
                });

                // Inclui também agendamentos fora da grade padrão (encaixes livres)
                agendamentosDia.forEach(a => {
                    const horaA = String(a.horario).substring(0, 5);
                    if (!horariosDia.includes(horaA)) {
                        itensRenderizacao.push({ tipo: 'agendamento', horario: horaA, dado: a });
                    }
                });

                itensRenderizacao.sort((a, b) => a.horario.localeCompare(b.horario));

                itensRenderizacao.forEach(item => {
                    const itemSlot = document.createElement("div");

                    let isRetroativo = false;
                    if (dia.iso < dataHojeIso) {
                        isRetroativo = true;
                    } else if (dia.iso === dataHojeIso) {
                        const [hSlot, mSlot] = item.horario.split(':').map(Number);
                        const minSlotTotal = hSlot * 60 + mSlot;
                        if (minSlotTotal < horaAtualMinutos) {
                            isRetroativo = true;
                        }
                    }

                    if (item.tipo === 'bloqueio') {
                        itemSlot.className = "slot-item blocked";
                        itemSlot.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight:bold;">${item.horario}</span>
                                <button type="button" onclick="event.stopPropagation(); alternarBloqueioHorario('${dia.iso}', '${item.horario}', true)" style="background: #2C1A1A; color: #e74c3c; border: 1px solid #e74c3c; padding: 1px 2px; border-radius: 2px; font-size: 0.45rem; cursor: pointer;">Desbl</button>
                            </div>
                        `;
                    } else if (item.tipo === 'agendamento') {
                        const ag = item.dado;
                        const isConcluido = ag.status === 'concluido';
                        const isEncaixe = ag.servico && ag.servico.includes("[ENCAIXE]");
                        
                        itemSlot.className = isConcluido ? "slot-item concluded" : "slot-item booked";
                        itemSlot.onclick = () => abrirGerenciadorAgendamento(ag.id);
                        itemSlot.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span style="font-weight:bold;">${item.horario}</span>
                                <span style="font-size: 0.48rem; color: ${isConcluido ? '#25D366' : '#3498db'}; font-weight: bold;">
                                    ${isConcluido ? 'OK' : (isEncaixe ? 'ENC' : 'AG')}
                                </span>
                            </div>
                            <div style="font-weight: 600; color: #FFD0B0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${ag.cliente}">
                                ${ag.cliente}
                            </div>
                        `;
                    } else if (isRetroativo) {
                        itemSlot.className = "slot-item retroactive";
                        itemSlot.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <span style="color:#666;">${item.horario}</span>
                                <span style="font-size: 0.4rem; color: #666;">Expirado</span>
                            </div>
                        `;
                    } else {
                        itemSlot.className = "slot-item available";
                        itemSlot.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                                <span style="color:#AAA;">${item.horario}</span>
                                <button type="button" onclick="event.stopPropagation(); alternarBloqueioHorario('${dia.iso}', '${item.horario}', false)" style="background: #242424; color: #FFF; border: 1px solid #444; padding: 0px 3px; border-radius: 2px; font-size: 0.45rem; cursor: pointer;">Bloq</button>
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
    const hoje = new Date();
    const yyyy = hoje.getFullYear();
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    
    document.getElementById("manual-data").value = `${yyyy}-${mm}-${dd}`;
    document.getElementById("manual-cliente").value = "";
    document.getElementById("manual-telefone").value = "";
    document.getElementById("manual-encaixe").checked = false;
    
    const containerHorario = document.getElementById("container-input-horario");
    containerHorario.innerHTML = `<select id="manual-horario"><option value="">Selecione a data primeiro</option></select>`;
    document.getElementById("label-horario-manual").textContent = "Horário Disponível:";

    renderizarSeletorServicos("manual-servicos-container", "manual-servico-chk", () => {
        calcularTotalManual();
        if (!document.getElementById("manual-encaixe").checked) {
            atualizarHorariosManuaisDisponiveis();
        }
    });

    calcularTotalManual();
    atualizarHorariosManuaisDisponiveis();
    document.getElementById("modal-agendamento-manual").classList.add("active");
}

function alternarModoEncaixe() {
    const chk = document.getElementById("manual-encaixe");
    const containerHorario = document.getElementById("container-input-horario");
    const labelHorario = document.getElementById("label-horario-manual");

    if (chk.checked) {
        labelHorario.textContent = "Horário do Encaixe (Livre):";
        containerHorario.innerHTML = `<input type="time" id="manual-horario" value="10:00" style="width: 100%; padding: 10px; background: #1A1A1A; border: 1px solid #FF6600; border-radius: 6px; color: #FFFFFF; font-size: 0.95rem; outline: none;">`;
    } else {
        labelHorario.textContent = "Horário Disponível:";
        containerHorario.innerHTML = `<select id="manual-horario"><option value="">A carregar horários...</option></select>`;
        atualizarHorariosManuaisDisponiveis();
    }
}

function calcularTotalManual() {
    let total = 0;
    document.querySelectorAll(".manual-servico-chk:checked").forEach(chk => {
        total += Number(chk.dataset.preco);
    });
    document.getElementById("manual-preco-total").textContent = `R$ ${total.toFixed(2).replace(".", ",")}`;
}

async function atualizarHorariosManuaisDisponiveis() {
    if (document.getElementById("manual-encaixe").checked) return;

    const dataSel = document.getElementById("manual-data").value;
    const horarioSelect = document.getElementById("manual-horario");
    if (!dataSel || !horarioSelect) return;

    const allSlots = obterHorariosParaData(dataSel);
    horarioSelect.innerHTML = "";
    
    if (allSlots.length === 0) {
        horarioSelect.innerHTML = "<option value=''>Willian não atende neste dia</option>";
        return;
    }

    allSlots.forEach(slot => {
        const opt = document.createElement("option");
        opt.value = slot;
        opt.textContent = slot;
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
    const data = document.getElementById("manual-data").value;
    const horarioEl = document.getElementById("manual-horario");
    const horario = horarioEl ? horarioEl.value : "";
    const ehEncaixe = document.getElementById("manual-encaixe").checked;

    let servicosSelecionados = [];
    let precoTotal = 0;
    document.querySelectorAll(".manual-servico-chk:checked").forEach(chk => {
        servicosSelecionados.push(chk.value);
        precoTotal += Number(chk.dataset.preco);
    });

    if (!cliente || !data || !horario || servicosSelecionados.length === 0) {
        mostrarAlerta("Preencha o Nome, Data, Horário e selecione ao menos um serviço.", false);
        return;
    }

    try {
        const servicoFinal = ehEncaixe ? `[ENCAIXE] ${servicosSelecionados.join(", ")}` : servicosSelecionados.join(", ");

        const { error } = await _supabase.from("agendamentos").insert([{
            barbeiro: usuarioLogado,
            cliente: cliente,
            telefone: telefone || "Balcão",
            servico: servicoFinal,
            preco_total: precoTotal > 0 ? precoTotal : 35,
            data: data,
            horario: horario,
            status: 'ativo'
        }]);

        if (error) throw error;

        fecharModalAgendamentoManual();
        mostrarAlerta("Agendamento adicionado com sucesso!", true);
        carregarAgendaSemanal();
    } catch (err) {
        mostrarAlerta("Falha ao salvar: " + err.message, false);
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
            <strong>Data/Hora:</strong> ${String(data.data).split("-").reverse().join("/")} às ${String(data.horario).substring(0,5)}
        `;

        paymentBox.style.display = "none";
        rescheduleBox.style.display = "none";

        // Renderiza serviços extras com o design em Pills no momento da validação do pagamento
        renderizarSeletorServicos("extras-servicos-container", "extra-servico-chk", null);
        
        function renderizarBotoesPrincipais() {
            buttonsBox.innerHTML = "";

            if (data.status !== 'concluido') {
                const btnAtendido = document.createElement("button");
                btnAtendido.type = "button";
                btnAtendido.className = "custom-modal-btn btn-modal-atendido";
                btnAtendido.textContent = "Concluir e Confirmar Pgto";
                btnAtendido.onclick = () => {
                    paymentBox.style.display = "block";
                    rescheduleBox.style.display = "none";
                    buttonsBox.innerHTML = "";

                    const btnSalvarPg = document.createElement("button");
                    btnSalvarPg.type = "button";
                    btnSalvarPg.className = "custom-modal-btn btn-modal-confirmar";
                    btnSalvarPg.textContent = "Salvar Atendimento e Pgto";
                    btnSalvarPg.onclick = async () => {
                        try {
                            btnSalvarPg.textContent = "A gravar...";
                            btnSalvarPg.disabled = true;
                            
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
                            const novaStringServicos = servicosList.join(", ");

                            const { error } = await _supabase.from("agendamentos")
                                .update({ 
                                    status: 'concluido', 
                                    pagamentos: formaPgto,
                                    servico: novaStringServicos,
                                    preco_total: novoPrecoTotal
                                })
                                .eq('id', data.id);

                            if (error) throw error;
                            
                            modal.classList.remove("active");
                            carregarAgendaSemanal();
                        } catch (err) {
                            mostrarAlerta("Erro ao concluir: " + err.message, false);
                            btnSalvarPg.textContent = "Salvar Atendimento e Pgto";
                            btnSalvarPg.disabled = false;
                        }
                    };

                    const btnVoltar = document.createElement("button");
                    btnVoltar.type = "button";
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
                btnReagendar.type = "button";
                btnReagendar.className = "custom-modal-btn btn-modal-reagendar";
                btnReagendar.textContent = "Reagendar Horário";
                btnReagendar.onclick = () => {
                    rescheduleBox.style.display = "block";
                    paymentBox.style.display = "none";
                    document.getElementById("new-reschedule-date").value = data.data;
                    document.getElementById("new-reschedule-time").value = String(data.horario).substring(0,5);
                    buttonsBox.innerHTML = "";

                    const btnSalvarReag = document.createElement("button");
                    btnSalvarReag.type = "button";
                    btnSalvarReag.className = "custom-modal-btn btn-modal-confirmar";
                    btnSalvarReag.textContent = "Confirmar Novo Horário";
                    btnSalvarReag.onclick = async () => {
                        const novaData = document.getElementById("new-reschedule-date").value;
                        const novoHorario = document.getElementById("new-reschedule-time").value;

                        try {
                            const { error } = await _supabase.from("agendamentos")
                                .update({ data: novaData, horario: novoHorario })
                                .eq('id', data.id);

                            if (error) throw error;
                            modal.classList.remove("active");
                            carregarAgendaSemanal();
                        } catch (err) {
                            mostrarAlerta("Erro ao reagendar: " + err.message, false);
                        }
                    };

                    const btnVoltarReag = document.createElement("button");
                    btnVoltarReag.type = "button";
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
                btnCancelar.type = "button";
                btnCancelar.className = "custom-modal-btn btn-modal-excluir";
                btnCancelar.textContent = "Cancelar Agendamento";
                btnCancelar.onclick = async () => {
                    try {
                        const { error } = await _supabase.from("agendamentos").update({ status: 'cancelado' }).eq('id', data.id);
                        if (error) throw error;
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
            btnFechar.type = "button";
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
    const resumoBarbeirosDiv = document.getElementById("admin-resumo-barbeiros");
    if (!dataFiltro || !container) return;
    
    container.innerHTML = "<p style='color: #888; text-align: center;'>A carregar...</p>";

    try {
        const { data } = await _supabase.from("agendamentos").select("*").eq("data", dataFiltro).order("horario", { ascending: true });
        container.innerHTML = "";
        const ativosOuConcluidos = (data || []).filter(a => a.status !== 'cancelado');

        if (ativosOuConcluidos.length === 0) {
            container.innerHTML = "<p style='color: #aaa; text-align: center; padding: 10px; background: #1A1A1A; border-radius: 6px;'>Sem agendamentos ativos para esta data.</p>";
            return;
        }

        ativosOuConcluidos.forEach(item => {
            const card = document.createElement("div");
            const isConcluido = item.status === 'concluido';
            card.style.cssText = "background: #1A1A1A; padding: 10px; border-radius: 6px; border: 1px solid #333; border-left: 4px solid " + (isConcluido ? '#25D366' : '#FF6600');
            card.innerHTML = `
                <strong style="font-size:0.85rem; color:#FFF;">${String(item.horario).substring(0,5)} - ${item.barbeiro}</strong><br>
                <span style="font-size:0.8rem; color:#CCC;">Cliente: ${item.cliente} | ${item.servico} | R$ ${Number(item.preco_total || 35).toFixed(2).replace(".", ",")} ${isConcluido ? `(Pago via ${item.pagamentos || 'Pix'})` : ''}</span>
            `;
            container.appendChild(card);
        });
    } catch (err) {
        container.innerHTML = "<p style='color: #e74c3c; text-align: center;'>Erro ao carregar.</p>";
    }
}
