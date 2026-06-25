--
-- PostgreSQL database dump
--

\restrict qlXZhUaSuUaFyCAXBiIcaTyL8qMvx6Djh9kcqEJiDy8g9tpt8XJ8hAtFistes2u

-- Dumped from database version 16.12
-- Dumped by pg_dump version 17.9 (Debian 17.9-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: sem_acento(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sem_acento(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
select
translate($1,'áàâãäéèêëíìïóòôõöúùûüÁÀÂÃÄÉÈÊËÍÌÏÓÒÔÕÖÚÙÛÜçÇ','aaaaaeeeeiiiooooouuuuAAAAAEEEEIIIOOOOOUUUUcC');
$_$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: acl; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acl (
    idpapel integer NOT NULL,
    idrecurso character varying(10) NOT NULL
);


--
-- Name: acl_idpapel_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.acl_idpapel_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: acl_idpapel_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.acl_idpapel_seq OWNED BY public.acl.idpapel;


--
-- Name: agenda; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agenda (
    idagenda integer NOT NULL,
    idtabpreco integer,
    dtagenda date,
    tpagenda character varying(5),
    nmpromocional character varying(50),
    dspromocional character varying(300),
    dtcadastro date,
    hrcadastro time without time zone,
    usucadastro character varying(11),
    dtualt date,
    hrualt time without time zone,
    usualt character varying(11),
    idinformacao integer,
    stagenda character varying(3)
);


--
-- Name: COLUMN agenda.tpagenda; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agenda.tpagenda IS 'padrao = Padrão promo = Promocional';


--
-- Name: COLUMN agenda.idinformacao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agenda.idinformacao IS 'Id referente a tabela de informacao';


--
-- Name: COLUMN agenda.stagenda; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.agenda.stagenda IS 'Status do dia da agenda:
abe: Aberto;
fec: Fechado, não é permitido compra neste dia.
lot: Lotado, não é permitido compra neste dia.';


--
-- Name: agenda_extras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agenda_extras (
    idagenda integer NOT NULL,
    idcliente integer NOT NULL,
    aceita_familia boolean DEFAULT false,
    slug character varying(255),
    foto text,
    criado_em timestamp without time zone DEFAULT now(),
    atualizado_em timestamp without time zone DEFAULT now(),
    idextra integer NOT NULL,
    stagenda_cli character(3) DEFAULT 'abe'::bpchar,
    dtualt_cli date,
    hrualt_cli time without time zone,
    usualt_cli character varying(50),
    CONSTRAINT ck_agenda_extras_stacli CHECK ((stagenda_cli = ANY (ARRAY['abe'::bpchar, 'fec'::bpchar])))
);


--
-- Name: agenda_extras_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agenda_extras_backup (
    idagenda integer,
    idcliente integer,
    aceita_familia boolean,
    slug character varying(255),
    foto text,
    criado_em timestamp without time zone,
    atualizado_em timestamp without time zone,
    idextra integer
);


--
-- Name: agenda_extras_idextra_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agenda_extras_idextra_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agenda_extras_idextra_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agenda_extras_idextra_seq OWNED BY public.agenda_extras.idextra;


--
-- Name: agenda_extras_bak_20251112; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agenda_extras_bak_20251112 (
    idagenda integer NOT NULL,
    idcliente integer NOT NULL,
    aceita_familia boolean DEFAULT false,
    slug character varying(255),
    foto text,
    criado_em timestamp without time zone DEFAULT now(),
    atualizado_em timestamp without time zone DEFAULT now(),
    idextra integer DEFAULT nextval('public.agenda_extras_idextra_seq'::regclass) NOT NULL
);


--
-- Name: agenda_faixas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agenda_faixas (
    idfaixa integer NOT NULL,
    idagenda integer NOT NULL,
    idade_min smallint NOT NULL,
    idade_max smallint NOT NULL,
    valor numeric(10,2) NOT NULL,
    idcliente integer,
    CONSTRAINT chk_ag_faixa_idade_ok CHECK ((idade_min <= idade_max))
);


--
-- Name: agenda_faixas_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agenda_faixas_backup (
    idfaixa integer,
    idagenda integer,
    idade_min smallint,
    idade_max smallint,
    valor numeric(10,2)
);


--
-- Name: agenda_faixas_idfaixa_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.agenda_faixas ALTER COLUMN idfaixa ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.agenda_faixas_idfaixa_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: agenda_idagenda_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agenda_idagenda_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agenda_idagenda_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agenda_idagenda_seq OWNED BY public.agenda.idagenda;


--
-- Name: agenda_idtabpreco_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.agenda_idtabpreco_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: agenda_idtabpreco_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.agenda_idtabpreco_seq OWNED BY public.agenda.idtabpreco;


--
-- Name: caixa_fechamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caixa_fechamentos (
    id integer NOT NULL,
    snapshot_json jsonb NOT NULL,
    totals_dinheiro numeric(12,2) DEFAULT 0 NOT NULL,
    totals_fundo numeric(12,2) DEFAULT 0 NOT NULL,
    totals_geral numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    periodo_id integer
);


--
-- Name: caixa_fechamentos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.caixa_fechamentos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.caixa_fechamentos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: caixa_periodos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.caixa_periodos (
    id integer NOT NULL,
    aberto_em timestamp with time zone DEFAULT now() NOT NULL,
    fechado_em timestamp with time zone,
    operador character varying(120),
    fechamento_auto boolean DEFAULT false NOT NULL,
    folha_id integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: caixa_periodos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.caixa_periodos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.caixa_periodos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cidade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cidade (
    idcidade integer NOT NULL,
    nmcidade character varying(100),
    iduf character varying(2)
);


--
-- Name: cliente_tipos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_tipos (
    idtipo integer NOT NULL,
    nome text NOT NULL
);


--
-- Name: cliente_tipos_idtipo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.cliente_tipos ALTER COLUMN idtipo ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.cliente_tipos_idtipo_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cliente_turma_periodos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_turma_periodos (
    idperiodo integer NOT NULL,
    idturma integer NOT NULL,
    nome character varying(80) NOT NULL,
    ordem integer DEFAULT 0,
    status character(3) DEFAULT 'ati'::bpchar,
    criado_em timestamp without time zone DEFAULT now(),
    atualizado_em timestamp without time zone DEFAULT now()
);


--
-- Name: cliente_turma_periodos_idperiodo_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_turma_periodos_idperiodo_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cliente_turma_periodos_idperiodo_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_turma_periodos_idperiodo_seq OWNED BY public.cliente_turma_periodos.idperiodo;


--
-- Name: cliente_turmas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cliente_turmas (
    idturma integer NOT NULL,
    idcliente integer NOT NULL,
    nome character varying(80) NOT NULL,
    ordem integer DEFAULT 0,
    status character(3) DEFAULT 'ati'::bpchar,
    criado_em timestamp without time zone DEFAULT now(),
    atualizado_em timestamp without time zone DEFAULT now()
);


--
-- Name: cliente_turmas_idturma_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cliente_turmas_idturma_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cliente_turmas_idturma_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cliente_turmas_idturma_seq OWNED BY public.cliente_turmas.idturma;


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    idcliente integer NOT NULL,
    idtipo integer NOT NULL,
    nome text NOT NULL,
    status boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL,
    atualizado_em timestamp without time zone
);


--
-- Name: clientes_backup; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes_backup (
    idcliente integer,
    idtipo integer,
    nome text,
    status boolean,
    criado_em timestamp without time zone,
    atualizado_em timestamp without time zone
);


--
-- Name: clientes_idcliente_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.clientes ALTER COLUMN idcliente ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.clientes_idcliente_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: codindica; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.codindica (
    codindica character varying(6) NOT NULL,
    nmrepresentante character varying(100),
    senharepresentante character varying(32),
    validade date,
    vldescnormal numeric(5,2),
    vldescinfant numeric(5,2),
    percomissao numeric(5,2),
    stcodindica character varying(3),
    dtcadastro date,
    hrcadastro time without time zone,
    usucadastro character varying(11),
    dtualt date,
    hrualt time without time zone,
    usualt character varying(11),
    email character varying(120),
    tpdesconto character varying(20),
    tpcashback character varying(20),
    vlcashback numeric(10,2),
    vlvendanormal numeric(10,2),
    vlvendainfant numeric(10,2),
    vlcashbackpadrao numeric(10,2),
    vlcashbacknormal numeric(10,2),
    vlcashbackinfant numeric(10,2),
    flpromocional character(1),
    vldescpromonormal numeric(10,2),
    vldescpromoinfant numeric(10,2),
    vlcashbackpromo numeric(10,2),
    vlcashbackpromonormal numeric(10,2),
    vlcashbackpromoinfant numeric(10,2)
);


--
-- Name: TABLE codindica; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.codindica IS 'Cadastro de códigos de indicação';


--
-- Name: COLUMN codindica.codindica; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.codindica.codindica IS 'Código da indicação digitado pelo usuário';


--
-- Name: COLUMN codindica.nmrepresentante; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.codindica.nmrepresentante IS 'Nome do representante';


--
-- Name: COLUMN codindica.senharepresentante; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.codindica.senharepresentante IS 'Senha do representante, para acesso ao módulo de representante';


--
-- Name: COLUMN codindica.validade; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.codindica.validade IS 'data de validade do código de indicação';


--
-- Name: COLUMN codindica.vldescnormal; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.codindica.vldescnormal IS 'valor de desconto para ingresso de valor normal';


--
-- Name: COLUMN codindica.vldescinfant; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.codindica.vldescinfant IS 'valor de desconto para ingresso infantil';


--
-- Name: COLUMN codindica.percomissao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.codindica.percomissao IS 'percentual de comissão, de 1 a 100';


--
-- Name: COLUMN codindica.stcodindica; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.codindica.stcodindica IS 'status do código de indicação ati - ativo ina - inativo';


--
-- Name: codindica_cashback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.codindica_cashback (
    idcashback integer NOT NULL,
    idcompra integer NOT NULL,
    codindica character varying(6) NOT NULL,
    nmrepresentante character varying(100),
    email character varying(120),
    tpcashback character varying(20) DEFAULT 'percentual'::character varying NOT NULL,
    vlbase numeric(10,2) DEFAULT 0 NOT NULL,
    vlcompra numeric(10,2) DEFAULT 0 NOT NULL,
    vldesconto numeric(10,2) DEFAULT 0 NOT NULL,
    qtitens integer DEFAULT 0 NOT NULL,
    vlcashback numeric(10,2) DEFAULT 0 NOT NULL,
    stcashback character varying(20) DEFAULT 'gerado'::character varying NOT NULL,
    stemail character varying(20) DEFAULT 'pendente'::character varying NOT NULL,
    msgemail character varying(255),
    dtcadastro date DEFAULT CURRENT_DATE NOT NULL,
    hrcadastro time without time zone DEFAULT CURRENT_TIME NOT NULL,
    dtenvio date,
    hrenvio time without time zone,
    dtcancelamento date,
    hrcancelamento time without time zone
);


--
-- Name: codindica_cashback_idcashback_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.codindica_cashback_idcashback_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: codindica_cashback_idcashback_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.codindica_cashback_idcashback_seq OWNED BY public.codindica_cashback.idcashback;


--
-- Name: compra; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compra (
    idcompra integer NOT NULL,
    cpf character varying(11),
    tpcompra character varying(5),
    dtcompra date,
    hrcompra time without time zone,
    formapag character varying(5),
    dtpagamento date,
    hrpagamento time without time zone,
    vltotcompra numeric(8,2),
    stcompra character varying(4),
    flenvio character varying(3),
    idconvenio integer,
    codindica character varying(6),
    vltotdesc numeric(8,2),
    vlcomiss numeric(8,2),
    vlcashback numeric(10,2) DEFAULT 0
);


--
-- Name: COLUMN compra.tpcompra; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compra.tpcompra IS 'reser = Reserva ponli = Pago online';


--
-- Name: COLUMN compra.formapag; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compra.formapag IS 'pgseg = PagSeguro N/A = Usado quando for agendamento.';


--
-- Name: COLUMN compra.stcompra; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compra.stcompra IS 'status da compra, se foi ou não concluida no pagseguro, pois ele pode fechar o borweser antes de finalziar a compra.
pend -> pendente (em processamento)
conc -> concluida';


--
-- Name: COLUMN compra.codindica; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compra.codindica IS 'código de indicação utilizado na compra';


--
-- Name: COLUMN compra.vltotdesc; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compra.vltotdesc IS 'valor de desconto total obtido pelo código de indicaçao utilizado';


--
-- Name: COLUMN compra.vlcomiss; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.compra.vlcomiss IS 'valor total de comissao do código de indicação';


--
-- Name: compra_idcompra_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.compra_idcompra_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: compra_idcompra_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.compra_idcompra_seq OWNED BY public.compra.idcompra;


--
-- Name: compra_pagamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compra_pagamentos (
    id integer NOT NULL,
    idcompra integer NOT NULL,
    forma_pagamento character(5) NOT NULL,
    valor numeric(10,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT compra_pagamentos_valor_check CHECK ((valor > (0)::numeric))
);


--
-- Name: compra_pagamentos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.compra_pagamentos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.compra_pagamentos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: conveniado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conveniado (
    idconvenio integer NOT NULL,
    cpf character varying(11) NOT NULL,
    qtcompradia integer,
    dtiniado date,
    dtfimado date,
    stconveniado character varying(4),
    dtcadastro date,
    hrcadastro time(0) without time zone,
    usucadastro character varying(11),
    dtualt date,
    hrualt time(0) without time zone,
    usualt character varying(11)
);


--
-- Name: COLUMN conveniado.stconveniado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.conveniado.stconveniado IS 'ativ = Ativo inat - Inativo';


--
-- Name: conveniado_idconvenio_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.conveniado_idconvenio_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: conveniado_idconvenio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.conveniado_idconvenio_seq OWNED BY public.conveniado.idconvenio;


--
-- Name: convenio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.convenio (
    idconvenio integer NOT NULL,
    nmconvenio character varying(120),
    idtabpreco integer NOT NULL,
    dtini date,
    dtfim date,
    stconvenio character varying(4),
    dtcadastro date,
    hrcadastro time without time zone,
    usucadastro character varying(11),
    dtualt date,
    hrualt time without time zone,
    usualt character varying(11)
);


--
-- Name: COLUMN convenio.stconvenio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.convenio.stconvenio IS 'ativ = Ativo inat = Inativo';


--
-- Name: convenio_idconvenio_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.convenio_idconvenio_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: convenio_idconvenio_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.convenio_idconvenio_seq OWNED BY public.convenio.idconvenio;


--
-- Name: convenio_idtabpreco_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.convenio_idtabpreco_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: convenio_idtabpreco_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.convenio_idtabpreco_seq OWNED BY public.convenio.idtabpreco;


--
-- Name: conveniocsvimp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conveniocsvimp (
    idconvenio integer NOT NULL,
    idconvenioimp integer NOT NULL,
    dtconvenioimp date,
    hrconvenioimp time without time zone
);


--
-- Name: conveniocsvimpdados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conveniocsvimpdados (
    idconvenio integer NOT NULL,
    idconvenioimp integer NOT NULL,
    cpf character varying(11) NOT NULL,
    qtcompradia integer,
    dtiniado date,
    dtfimado date,
    stconveniado character varying(3)
);


--
-- Name: cortesias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cortesias (
    id integer NOT NULL,
    nome character varying(100) NOT NULL
);


--
-- Name: cortesias_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cortesias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cortesias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cortesias_id_seq OWNED BY public.cortesias.id;


--
-- Name: cortesias_tipos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cortesias_tipos (
    id integer NOT NULL,
    descricao character varying(50) NOT NULL
);


--
-- Name: cortesias_tipos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cortesias_tipos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cortesias_tipos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cortesias_tipos_id_seq OWNED BY public.cortesias_tipos.id;


--
-- Name: descontos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.descontos (
    id integer NOT NULL,
    tipo_id integer NOT NULL,
    nome character varying(100) NOT NULL,
    tipo_aplicacao character varying(20) NOT NULL,
    valor numeric(10,2) DEFAULT 0 NOT NULL,
    CONSTRAINT descontos_tipo_aplicacao_check CHECK (((tipo_aplicacao)::text = ANY (ARRAY[('percentual'::character varying)::text, ('valor_fixo'::character varying)::text])))
);


--
-- Name: descontos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.descontos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: descontos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.descontos_id_seq OWNED BY public.descontos.id;


--
-- Name: descontos_tipos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.descontos_tipos (
    id integer NOT NULL,
    descricao character varying(50) NOT NULL
);


--
-- Name: descontos_tipos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.descontos_tipos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: descontos_tipos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.descontos_tipos_id_seq OWNED BY public.descontos_tipos.id;


--
-- Name: edicoes_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.edicoes_log (
    id integer NOT NULL,
    origem character varying(30) NOT NULL,
    acao character varying(30) NOT NULL,
    compra_id integer,
    movimentacao_id integer,
    movimentacao_tipo character varying(20),
    descricao text NOT NULL,
    motivo text NOT NULL,
    usuario_nome character varying(255),
    detalhes_json text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    periodo_id integer,
    folha_id integer
);


--
-- Name: edicoes_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.edicoes_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: edicoes_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.edicoes_log_id_seq OWNED BY public.edicoes_log.id;


--
-- Name: email; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email (
    idemail bigint NOT NULL,
    envid character varying(35),
    de character varying(200),
    nomede character varying(100),
    para character varying(200),
    nomepara character varying(100),
    resppara character varying(200),
    assunto character varying(255),
    conteudo text,
    flanexo character varying(3),
    dtemail date,
    hremail time without time zone,
    stemail character varying(3),
    dtenv date,
    hrenv time without time zone,
    erros integer
);


--
-- Name: COLUMN email.resppara; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email.resppara IS 'email do responder para, opcional, caso preenchido deve inclir o email indicado aqui no responder para.';


--
-- Name: COLUMN email.flanexo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.email.flanexo IS 'Indica se o email contem arquivos anexos. Caso sim, no momento de envio será procurado no diretorio de anexos de email todos os arquivos salvos para envio.';


--
-- Name: email_idemail_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_idemail_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_idemail_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_idemail_seq OWNED BY public.email.idemail;


--
-- Name: error_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.error_logs (
    id integer NOT NULL,
    endpoint text,
    message text NOT NULL,
    details text,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    request_body text
);


--
-- Name: error_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.error_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: error_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.error_logs_id_seq OWNED BY public.error_logs.id;


--
-- Name: escola_idescola_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.escola_idescola_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: escola; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escola (
    idescola integer DEFAULT nextval('public.escola_idescola_seq'::regclass) NOT NULL,
    nmescola character varying(50) NOT NULL,
    stescola character varying(3) NOT NULL,
    dtcadastro date,
    hrcadastro time without time zone,
    usucadastro character varying(11),
    dtualt date,
    hrualt time without time zone,
    usualt character varying(11),
    datapasseio date,
    textoinfo character varying(6000),
    idinformacao integer
);


--
-- Name: escoladata; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.escoladata (
    idescola integer NOT NULL,
    idagenda integer NOT NULL,
    status character varying(3),
    dtcadastro date,
    hrcadastro time without time zone,
    dtualt date,
    hrualt time without time zone,
    usucadastro character varying(11),
    usualt character varying(11),
    codescoladata character varying(6),
    permalink character varying(12)
);


--
-- Name: TABLE escoladata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.escoladata IS 'Escola data é chamado de Passeio na rincão. 
Passeio da Escola.';


--
-- Name: COLUMN escoladata.codescoladata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.escoladata.codescoladata IS 'Utilizada para facilitar a busca do passeio de escola na area de bilheteria. Nao deve ser utilizado como chave primaria.';


--
-- Name: informacao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.informacao (
    idinformacao integer NOT NULL,
    nome character varying(60),
    texto character varying(6000),
    status character varying(3)
);


--
-- Name: informacao_idinformacao_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.informacao_idinformacao_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: informacao_idinformacao_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.informacao_idinformacao_seq OWNED BY public.informacao.idinformacao;


--
-- Name: ingressos_especiais; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingressos_especiais (
    id integer NOT NULL,
    tipo_id integer NOT NULL,
    nome character varying(80) NOT NULL,
    valor numeric(8,2) NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    criado_em timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ingressos_especiais_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingressos_especiais_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingressos_especiais_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingressos_especiais_id_seq OWNED BY public.ingressos_especiais.id;


--
-- Name: ingressos_especiais_tipos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingressos_especiais_tipos (
    id integer NOT NULL,
    descricao character varying(60) NOT NULL,
    ativo boolean DEFAULT true NOT NULL
);


--
-- Name: ingressos_especiais_tipos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingressos_especiais_tipos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingressos_especiais_tipos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingressos_especiais_tipos_id_seq OWNED BY public.ingressos_especiais_tipos.id;


--
-- Name: movimentacao_caixa_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.movimentacao_caixa_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movimentacao_caixa; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movimentacao_caixa (
    id integer DEFAULT nextval('public.movimentacao_caixa_id_seq'::regclass) NOT NULL,
    tipo character varying(10) NOT NULL,
    responsavel character varying(100) NOT NULL,
    valor numeric(10,2) NOT NULL,
    data_hora timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT movimentacao_caixa_valor_check CHECK ((valor >= (0)::numeric))
);


--
-- Name: pagpagseguro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagpagseguro (
    idcompra integer NOT NULL,
    idpagseguro character varying(80) NOT NULL,
    date timestamp(0) without time zone,
    reference character varying(200),
    status integer,
    "cancellationSource" character varying(10),
    "lastEventDate" timestamp(0) without time zone,
    paymentmethodtype integer,
    "paymentMethodCode" integer,
    "grossAmount" numeric(15,2),
    "discountAmount" numeric(15,2),
    "feeAmount" numeric(15,2),
    "netAmount" numeric(15,2),
    "extraAmount" numeric(15,2),
    "installmentCount" integer,
    "senderEmail" character varying(60),
    "senderName" character varying(200),
    "senderPhoneAreaCode" numeric(2,0),
    "senderPhoneNumber" character varying(10),
    "shippingType" integer,
    "shippingCost" numeric(15,2),
    "shippingAdressStreet" text,
    "shippingAdressNumber" text,
    "shippingAdressDistrict" text,
    "shippingAdressCity" text,
    "shippingAdressState" character varying(2),
    "shippingAdressCountry" text,
    "shippingAdressPostalCode" numeric(8,0),
    "xmlRequisicao" text
);
ALTER TABLE ONLY public.pagpagseguro ALTER COLUMN "shippingAdressNumber" SET STATISTICS 10;


--
-- Name: COLUMN pagpagseguro.idpagseguro; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro.idpagseguro IS 'Código identificador da transação';


--
-- Name: COLUMN pagpagseguro.date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro.date IS 'Data da criação da transação';


--
-- Name: COLUMN pagpagseguro.reference; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro.reference IS 'Código de referência da transação.';


--
-- Name: COLUMN pagpagseguro.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro.status IS 'Status da transação.';


--
-- Name: COLUMN pagpagseguro."cancellationSource"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."cancellationSource" IS 'Origem do cancelamento.';


--
-- Name: COLUMN pagpagseguro."lastEventDate"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."lastEventDate" IS 'Data do último evento.';


--
-- Name: COLUMN pagpagseguro.paymentmethodtype; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro.paymentmethodtype IS 'Tipo do meio de pagamento.';


--
-- Name: COLUMN pagpagseguro."paymentMethodCode"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."paymentMethodCode" IS 'Código identificador do meio de pagamento';


--
-- Name: COLUMN pagpagseguro."grossAmount"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."grossAmount" IS 'Valor bruto da transação.';


--
-- Name: COLUMN pagpagseguro."discountAmount"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."discountAmount" IS 'Valor do desconto dado.';


--
-- Name: COLUMN pagpagseguro."feeAmount"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."feeAmount" IS 'Taxa pagseguro';


--
-- Name: COLUMN pagpagseguro."netAmount"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."netAmount" IS 'Valor líquido da transação.';


--
-- Name: COLUMN pagpagseguro."extraAmount"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."extraAmount" IS 'Valor extra.';


--
-- Name: COLUMN pagpagseguro."installmentCount"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."installmentCount" IS 'Número de parcelas.';


--
-- Name: COLUMN pagpagseguro."senderEmail"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."senderEmail" IS 'E-mail do comprador.';


--
-- Name: COLUMN pagpagseguro."senderName"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."senderName" IS 'Nome completo do comprador.';


--
-- Name: COLUMN pagpagseguro."senderPhoneAreaCode"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."senderPhoneAreaCode" IS 'DDD do comprador.';


--
-- Name: COLUMN pagpagseguro."senderPhoneNumber"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."senderPhoneNumber" IS 'Número de telefone do comprador.';


--
-- Name: COLUMN pagpagseguro."shippingType"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."shippingType" IS 'Tipo de frete.';


--
-- Name: COLUMN pagpagseguro."shippingCost"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."shippingCost" IS 'Custo total do frete.';


--
-- Name: COLUMN pagpagseguro."shippingAdressStreet"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."shippingAdressStreet" IS 'Nome da rua do endereço de envio.';


--
-- Name: COLUMN pagpagseguro."shippingAdressNumber"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."shippingAdressNumber" IS 'Número do endereço de envio.';


--
-- Name: COLUMN pagpagseguro."shippingAdressDistrict"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."shippingAdressDistrict" IS 'Bairro do endereço de envio.';


--
-- Name: COLUMN pagpagseguro."shippingAdressCity"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."shippingAdressCity" IS 'Cidade do endereço de envio.';


--
-- Name: COLUMN pagpagseguro."shippingAdressState"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."shippingAdressState" IS 'Estado do endereço de envio.';


--
-- Name: COLUMN pagpagseguro."shippingAdressCountry"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."shippingAdressCountry" IS 'País do endereço de envio.';


--
-- Name: COLUMN pagpagseguro."shippingAdressPostalCode"; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.pagpagseguro."shippingAdressPostalCode" IS 'CEP do endereço de envio.';


--
-- Name: pagpagseguro_idcompra_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagpagseguro_idcompra_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagpagseguro_idcompra_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagpagseguro_idcompra_seq OWNED BY public.pagpagseguro.idcompra;


--
-- Name: papel; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.papel (
    idpapel integer NOT NULL,
    nmpapel character varying(35),
    dtualt date,
    hrualt time without time zone,
    usualt character varying(11),
    dtcadastro date,
    hrcadastro time without time zone,
    usucadastro character varying(11)
);


--
-- Name: COLUMN papel.nmpapel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.papel.nmpapel IS 'Bilheteria Administrador';


--
-- Name: papel_idpapel_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.papel_idpapel_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: papel_idpapel_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.papel_idpapel_seq OWNED BY public.papel.idpapel;


--
-- Name: parametro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parametro (
    idparametro character varying(7),
    grparametro character varying(6),
    vlparametro character varying(255)
);


--
-- Name: TABLE parametro; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.parametro IS 'Armazena os parametros do sistema - Mensagens personalizadas para exibição na utilização do código de indicação 
 Utilizado como base a classe de paramatro do projeto Bferraz';


--
-- Name: COLUMN parametro.idparametro; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.parametro.idparametro IS 'codval - codigo valido codven - codigo vencido codine - codigo inexistente';


--
-- Name: COLUMN parametro.grparametro; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.parametro.grparametro IS 'cadastros de mensagens personalizadas devem registrar o valor "msgper" - ';


--
-- Name: COLUMN parametro.vlparametro; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.parametro.vlparametro IS 'Texto cadastrado no painel';


--
-- Name: people_in_park; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.people_in_park (
    id integer NOT NULL,
    comprado_no_site boolean DEFAULT false,
    pago_no_parque boolean DEFAULT false,
    status text,
    type text,
    date date,
    idvoucher text,
    idcompra text,
    periodo_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: people_in_park_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.people_in_park_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: people_in_park_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.people_in_park_id_seq OWNED BY public.people_in_park.id;


--
-- Name: socio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.socio (
    cpf character varying(11) NOT NULL,
    nmsocio character varying(120),
    dtinisoc date,
    dtfimsoc date,
    qtcompradia integer,
    stsocio character varying(4),
    idsociocateg integer NOT NULL,
    dtcadastro date,
    hrcadastro time(0) without time zone,
    usucadastro character varying(11),
    dtualt date,
    hrualt time(0) without time zone,
    usualt character varying(11)
);


--
-- Name: COLUMN socio.stsocio; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.socio.stsocio IS 'ativ = ativo inat = inativo';


--
-- Name: socio_idsociocateg_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.socio_idsociocateg_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: socio_idsociocateg_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.socio_idsociocateg_seq OWNED BY public.socio.idsociocateg;


--
-- Name: sociocateg; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sociocateg (
    idsociocateg integer NOT NULL,
    nmcategoria character varying(50),
    idtabpreco integer NOT NULL,
    dtcadastro date,
    hrcadastro time(0) without time zone,
    usucadastro character varying(11),
    dtualt date,
    hrualt time(0) without time zone,
    usualt character varying(11)
);


--
-- Name: sociocateg_idsociocateg_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sociocateg_idsociocateg_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sociocateg_idsociocateg_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sociocateg_idsociocateg_seq OWNED BY public.sociocateg.idsociocateg;


--
-- Name: sociocateg_idtabpreco_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sociocateg_idtabpreco_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sociocateg_idtabpreco_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sociocateg_idtabpreco_seq OWNED BY public.sociocateg.idtabpreco;


--
-- Name: tabpreco; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tabpreco (
    idtabpreco integer NOT NULL,
    nmtabpreco character varying(50),
    vlnormal numeric(8,2),
    vlinfant numeric(8,2),
    sttabpreco character varying(4),
    dtcadastro date,
    hrcadastro time without time zone,
    usucadastro character varying(11),
    dtualt date,
    hrualt time without time zone,
    usualt character varying(11),
    vlnormalbil numeric(8,2),
    vlinfantbil numeric(8,2)
);


--
-- Name: COLUMN tabpreco.sttabpreco; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tabpreco.sttabpreco IS 'ativ = Ativo inat = Inativo';


--
-- Name: tabpreco_idtabpreco_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tabpreco_idtabpreco_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tabpreco_idtabpreco_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tabpreco_idtabpreco_seq OWNED BY public.tabpreco.idtabpreco;


--
-- Name: trocasenha; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trocasenha (
    idtrocasenha integer NOT NULL,
    ticket character varying(35),
    cpf character varying(11) NOT NULL,
    flusado character(1),
    dtvalidade date,
    dtuso date
);


--
-- Name: TABLE trocasenha; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.trocasenha IS 'Tabela contendo as solicitações de troca de senha. quando o usuario usa a funcionalidade de "esqueci minha senha"';


--
-- Name: COLUMN trocasenha.flusado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.trocasenha.flusado IS 's - sim n- nao';


--
-- Name: trocasenha_idtrocasenha_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.trocasenha_idtrocasenha_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trocasenha_idtrocasenha_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.trocasenha_idtrocasenha_seq OWNED BY public.trocasenha.idtrocasenha;


--
-- Name: uf; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.uf (
    iduf character varying(2) NOT NULL,
    nmuf character varying(40)
);


--
-- Name: usuario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuario (
    cpf character varying(11) NOT NULL,
    nmusuario character varying(120),
    idpapel integer,
    email character varying(120),
    cep character varying(8),
    uf character varying(2),
    bairro character varying(50),
    endereco character varying(100),
    complemento character varying(50),
    telefone character varying(14),
    celular character varying(14),
    senha character varying(32),
    dtulogin date,
    hrulogin time without time zone,
    dtcadastro date,
    hrcadastro time without time zone,
    dtualt date,
    hrualt time without time zone,
    stusuario character(3),
    usucadastro character varying(11),
    usualt character varying(11),
    rg character varying(10),
    dtnascimento date,
    sexo character(1),
    cidade integer,
    numero integer
);


--
-- Name: COLUMN usuario.idpapel; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.usuario.idpapel IS 'Indicará se é um usuário administrador, bilheteria, etc. Quando null indica que é um usuário de cliente.';


--
-- Name: COLUMN usuario.uf; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.usuario.uf IS 'Array UFs do Brasil.';


--
-- Name: usuario_idpapel_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.usuario_idpapel_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: usuario_idpapel_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.usuario_idpapel_seq OWNED BY public.usuario.idpapel;


--
-- Name: voucher; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voucher (
    idvoucher integer NOT NULL,
    idcompra integer NOT NULL,
    numvoucher character varying(10),
    idagenda integer NOT NULL,
    tpvoucher character varying(5),
    vlunicompra numeric(8,2),
    stusado character varying(3),
    dtuso date,
    hruso time without time zone,
    fldesconto character(1),
    idescola integer,
    nomealuno character varying(50),
    turma character varying(50),
    periodo character varying(50),
    codindica character varying(6),
    vldesc numeric(8,2),
    voucherenviado character(1) DEFAULT 'n'::bpchar NOT NULL,
    descricao text,
    item_id integer,
    autorizado_por_id integer,
    identificacao character varying(80),
    dtvalidade date,
    desconto_id integer,
    tpparticipante text DEFAULT 'aluno'::text NOT NULL,
    nomeeducador character varying(80),
    funcaoeducador text,
    observacao character varying(255),
    periodo_id integer,
    closed_at timestamp without time zone,
    ensino_tipo character varying(40),
    ensino_ano character varying(40),
    turma_letra character(1),
    CONSTRAINT voucher_funcaoeducador_check CHECK ((funcaoeducador = ANY (ARRAY['Coordenador'::text, 'Diretor'::text, 'Professor'::text, 'Outros'::text]))),
    CONSTRAINT voucher_tpparticipante_check CHECK ((tpparticipante = ANY (ARRAY['aluno'::text, 'educador'::text])))
);


--
-- Name: TABLE voucher; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.voucher IS 'Gerar código randomico com 10 caracteres (alfa numerico). 
 -Não utilizar letras/número considerados de confusão. (Ex.: O e 0, l e I (i maiusculo), etc.)';


--
-- Name: COLUMN voucher.numvoucher; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.voucher.numvoucher IS 'Não utilizar letras e números de confusão, ex: 0 e O, V e U, I e i.';


--
-- Name: COLUMN voucher.tpvoucher; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.voucher.tpvoucher IS 'reser = Reserva norma = Normal infan = Infantil';


--
-- Name: COLUMN voucher.stusado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.voucher.stusado IS 'Sim Não';


--
-- Name: COLUMN voucher.fldesconto; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.voucher.fldesconto IS 'indica se o voucher foi gerado com desconto o não.
s - Sim
n - Não
null - isento';


--
-- Name: COLUMN voucher.codindica; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.voucher.codindica IS 'Email que será enviado a confirmação de finalização de uma compra utilizando um codigo de indicação';


--
-- Name: voucher_backup_20251103; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voucher_backup_20251103 (
    idvoucher integer,
    idcompra integer,
    numvoucher character varying(10),
    idagenda integer,
    tpvoucher character varying(5),
    vlunicompra numeric(8,2),
    stusado character varying(3),
    dtuso date,
    hruso time without time zone,
    fldesconto character(1),
    idescola integer,
    nomealuno character varying(50),
    turma character varying(50),
    periodo character varying(50),
    codindica character varying(6),
    vldesc numeric(8,2),
    voucherenviado character(1),
    descricao text,
    item_id integer,
    autorizado_por_id integer,
    identificacao character varying(80),
    dtvalidade date,
    desconto_id integer,
    tpparticipante text,
    nomeeducador character varying(80),
    funcaoeducador text,
    observacao character varying(255)
);


--
-- Name: voucher_backup_20251104; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voucher_backup_20251104 (
    idvoucher integer,
    idcompra integer,
    numvoucher character varying(10),
    idagenda integer,
    tpvoucher character varying(5),
    vlunicompra numeric(8,2),
    stusado character varying(3),
    dtuso date,
    hruso time without time zone,
    fldesconto character(1),
    idescola integer,
    nomealuno character varying(50),
    turma character varying(50),
    periodo character varying(50),
    codindica character varying(6),
    vldesc numeric(8,2),
    voucherenviado character(1),
    descricao text,
    item_id integer,
    autorizado_por_id integer,
    identificacao character varying(80),
    dtvalidade date,
    desconto_id integer,
    tpparticipante text,
    nomeeducador character varying(80),
    funcaoeducador text,
    observacao character varying(255)
);


--
-- Name: voucher_backup_delta_20251103; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voucher_backup_delta_20251103 (
    idvoucher integer,
    idcompra integer,
    numvoucher character varying(10),
    idagenda integer,
    tpvoucher character varying(5),
    vlunicompra numeric(8,2),
    stusado character varying(3),
    dtuso date,
    hruso time without time zone,
    fldesconto character(1),
    idescola integer,
    nomealuno character varying(50),
    turma character varying(50),
    periodo character varying(50),
    codindica character varying(6),
    vldesc numeric(8,2),
    voucherenviado character(1),
    descricao text,
    item_id integer,
    autorizado_por_id integer,
    identificacao character varying(80),
    dtvalidade date,
    desconto_id integer,
    tpparticipante text,
    nomeeducador character varying(80),
    funcaoeducador text,
    observacao character varying(255)
);


--
-- Name: voucher_idagenda_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.voucher_idagenda_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: voucher_idagenda_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.voucher_idagenda_seq OWNED BY public.voucher.idagenda;


--
-- Name: voucher_idcompra_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.voucher_idcompra_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: voucher_idcompra_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.voucher_idcompra_seq OWNED BY public.voucher.idcompra;


--
-- Name: voucher_idvoucher_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.voucher_idvoucher_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: voucher_idvoucher_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.voucher_idvoucher_seq OWNED BY public.voucher.idvoucher;


--
-- Name: vw_mapa_escola_cliente; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.vw_mapa_escola_cliente AS
 SELECT e.idescola,
    e.nmescola,
    c.idcliente,
    c.nome AS nome_cliente
   FROM (public.escola e
     JOIN public.clientes c ON ((lower(btrim(c.nome)) = lower(btrim((e.nmescola)::text)))))
  WHERE (c.idtipo = 4);


--
-- Name: acl idpapel; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acl ALTER COLUMN idpapel SET DEFAULT nextval('public.acl_idpapel_seq'::regclass);


--
-- Name: agenda idagenda; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda ALTER COLUMN idagenda SET DEFAULT nextval('public.agenda_idagenda_seq'::regclass);


--
-- Name: agenda idtabpreco; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda ALTER COLUMN idtabpreco SET DEFAULT nextval('public.agenda_idtabpreco_seq'::regclass);


--
-- Name: agenda_extras idextra; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_extras ALTER COLUMN idextra SET DEFAULT nextval('public.agenda_extras_idextra_seq'::regclass);


--
-- Name: cliente_turma_periodos idperiodo; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_turma_periodos ALTER COLUMN idperiodo SET DEFAULT nextval('public.cliente_turma_periodos_idperiodo_seq'::regclass);


--
-- Name: cliente_turmas idturma; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_turmas ALTER COLUMN idturma SET DEFAULT nextval('public.cliente_turmas_idturma_seq'::regclass);


--
-- Name: codindica_cashback idcashback; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codindica_cashback ALTER COLUMN idcashback SET DEFAULT nextval('public.codindica_cashback_idcashback_seq'::regclass);


--
-- Name: compra idcompra; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compra ALTER COLUMN idcompra SET DEFAULT nextval('public.compra_idcompra_seq'::regclass);


--
-- Name: conveniado idconvenio; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conveniado ALTER COLUMN idconvenio SET DEFAULT nextval('public.conveniado_idconvenio_seq'::regclass);


--
-- Name: convenio idconvenio; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio ALTER COLUMN idconvenio SET DEFAULT nextval('public.convenio_idconvenio_seq'::regclass);


--
-- Name: convenio idtabpreco; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio ALTER COLUMN idtabpreco SET DEFAULT nextval('public.convenio_idtabpreco_seq'::regclass);


--
-- Name: cortesias id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cortesias ALTER COLUMN id SET DEFAULT nextval('public.cortesias_id_seq'::regclass);


--
-- Name: cortesias_tipos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cortesias_tipos ALTER COLUMN id SET DEFAULT nextval('public.cortesias_tipos_id_seq'::regclass);


--
-- Name: descontos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descontos ALTER COLUMN id SET DEFAULT nextval('public.descontos_id_seq'::regclass);


--
-- Name: descontos_tipos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descontos_tipos ALTER COLUMN id SET DEFAULT nextval('public.descontos_tipos_id_seq'::regclass);


--
-- Name: edicoes_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edicoes_log ALTER COLUMN id SET DEFAULT nextval('public.edicoes_log_id_seq'::regclass);


--
-- Name: email idemail; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email ALTER COLUMN idemail SET DEFAULT nextval('public.email_idemail_seq'::regclass);


--
-- Name: error_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_logs ALTER COLUMN id SET DEFAULT nextval('public.error_logs_id_seq'::regclass);


--
-- Name: informacao idinformacao; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.informacao ALTER COLUMN idinformacao SET DEFAULT nextval('public.informacao_idinformacao_seq'::regclass);


--
-- Name: ingressos_especiais id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingressos_especiais ALTER COLUMN id SET DEFAULT nextval('public.ingressos_especiais_id_seq'::regclass);


--
-- Name: ingressos_especiais_tipos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingressos_especiais_tipos ALTER COLUMN id SET DEFAULT nextval('public.ingressos_especiais_tipos_id_seq'::regclass);


--
-- Name: pagpagseguro idcompra; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagpagseguro ALTER COLUMN idcompra SET DEFAULT nextval('public.pagpagseguro_idcompra_seq'::regclass);


--
-- Name: papel idpapel; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.papel ALTER COLUMN idpapel SET DEFAULT nextval('public.papel_idpapel_seq'::regclass);


--
-- Name: people_in_park id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_in_park ALTER COLUMN id SET DEFAULT nextval('public.people_in_park_id_seq'::regclass);


--
-- Name: socio idsociocateg; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.socio ALTER COLUMN idsociocateg SET DEFAULT nextval('public.socio_idsociocateg_seq'::regclass);


--
-- Name: sociocateg idsociocateg; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sociocateg ALTER COLUMN idsociocateg SET DEFAULT nextval('public.sociocateg_idsociocateg_seq'::regclass);


--
-- Name: sociocateg idtabpreco; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sociocateg ALTER COLUMN idtabpreco SET DEFAULT nextval('public.sociocateg_idtabpreco_seq'::regclass);


--
-- Name: tabpreco idtabpreco; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tabpreco ALTER COLUMN idtabpreco SET DEFAULT nextval('public.tabpreco_idtabpreco_seq'::regclass);


--
-- Name: trocasenha idtrocasenha; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trocasenha ALTER COLUMN idtrocasenha SET DEFAULT nextval('public.trocasenha_idtrocasenha_seq'::regclass);


--
-- Name: voucher idvoucher; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher ALTER COLUMN idvoucher SET DEFAULT nextval('public.voucher_idvoucher_seq'::regclass);


--
-- Name: voucher idagenda; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher ALTER COLUMN idagenda SET DEFAULT nextval('public.voucher_idagenda_seq'::regclass);


--
-- Name: agenda_extras_bak_20251112 agenda_extras_bak_20251112_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_extras_bak_20251112
    ADD CONSTRAINT agenda_extras_bak_20251112_pkey PRIMARY KEY (idagenda, idcliente);


--
-- Name: agenda_faixas agenda_faixas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_faixas
    ADD CONSTRAINT agenda_faixas_pkey PRIMARY KEY (idfaixa);


--
-- Name: caixa_fechamentos caixa_fechamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_fechamentos
    ADD CONSTRAINT caixa_fechamentos_pkey PRIMARY KEY (id);


--
-- Name: caixa_periodos caixa_periodos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_periodos
    ADD CONSTRAINT caixa_periodos_pkey PRIMARY KEY (id);


--
-- Name: cidade cidade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cidade
    ADD CONSTRAINT cidade_pkey PRIMARY KEY (idcidade);


--
-- Name: cliente_tipos cliente_tipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_tipos
    ADD CONSTRAINT cliente_tipos_pkey PRIMARY KEY (idtipo);


--
-- Name: cliente_turma_periodos cliente_turma_periodos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_turma_periodos
    ADD CONSTRAINT cliente_turma_periodos_pkey PRIMARY KEY (idperiodo);


--
-- Name: cliente_turmas cliente_turmas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_turmas
    ADD CONSTRAINT cliente_turmas_pkey PRIMARY KEY (idturma);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (idcliente);


--
-- Name: codindica_cashback codindica_cashback_idcompra_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codindica_cashback
    ADD CONSTRAINT codindica_cashback_idcompra_key UNIQUE (idcompra);


--
-- Name: codindica_cashback codindica_cashback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codindica_cashback
    ADD CONSTRAINT codindica_cashback_pkey PRIMARY KEY (idcashback);


--
-- Name: codindica codindica_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.codindica
    ADD CONSTRAINT codindica_pkey PRIMARY KEY (codindica);


--
-- Name: compra_pagamentos compra_pagamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compra_pagamentos
    ADD CONSTRAINT compra_pagamentos_pkey PRIMARY KEY (id);


--
-- Name: conveniocsvimp conveniocsvimp_idx; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conveniocsvimp
    ADD CONSTRAINT conveniocsvimp_idx PRIMARY KEY (idconvenio, idconvenioimp);


--
-- Name: conveniocsvimpdados convenioimpdados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conveniocsvimpdados
    ADD CONSTRAINT convenioimpdados_pkey PRIMARY KEY (idconvenio, idconvenioimp, cpf);


--
-- Name: cortesias cortesias_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cortesias
    ADD CONSTRAINT cortesias_nome_key UNIQUE (nome);


--
-- Name: cortesias cortesias_nome_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cortesias
    ADD CONSTRAINT cortesias_nome_key1 UNIQUE (nome);


--
-- Name: cortesias cortesias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cortesias
    ADD CONSTRAINT cortesias_pkey PRIMARY KEY (id);


--
-- Name: cortesias_tipos cortesias_tipos_descricao_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cortesias_tipos
    ADD CONSTRAINT cortesias_tipos_descricao_key UNIQUE (descricao);


--
-- Name: cortesias_tipos cortesias_tipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cortesias_tipos
    ADD CONSTRAINT cortesias_tipos_pkey PRIMARY KEY (id);


--
-- Name: descontos descontos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descontos
    ADD CONSTRAINT descontos_pkey PRIMARY KEY (id);


--
-- Name: descontos_tipos descontos_tipos_descricao_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descontos_tipos
    ADD CONSTRAINT descontos_tipos_descricao_key UNIQUE (descricao);


--
-- Name: descontos_tipos descontos_tipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descontos_tipos
    ADD CONSTRAINT descontos_tipos_pkey PRIMARY KEY (id);


--
-- Name: edicoes_log edicoes_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.edicoes_log
    ADD CONSTRAINT edicoes_log_pkey PRIMARY KEY (id);


--
-- Name: error_logs error_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.error_logs
    ADD CONSTRAINT error_logs_pkey PRIMARY KEY (id);


--
-- Name: escola escola_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escola
    ADD CONSTRAINT escola_pkey PRIMARY KEY (idescola);


--
-- Name: escoladata escoladata_un; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escoladata
    ADD CONSTRAINT escoladata_un UNIQUE (codescoladata);


--
-- Name: informacao informacao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.informacao
    ADD CONSTRAINT informacao_pkey PRIMARY KEY (idinformacao);


--
-- Name: ingressos_especiais ingressos_especiais_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingressos_especiais
    ADD CONSTRAINT ingressos_especiais_pkey PRIMARY KEY (id);


--
-- Name: ingressos_especiais_tipos ingressos_especiais_tipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingressos_especiais_tipos
    ADD CONSTRAINT ingressos_especiais_tipos_pkey PRIMARY KEY (id);


--
-- Name: movimentacao_caixa movimentacao_caixa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movimentacao_caixa
    ADD CONSTRAINT movimentacao_caixa_pkey PRIMARY KEY (id);


--
-- Name: people_in_park people_in_park_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people_in_park
    ADD CONSTRAINT people_in_park_pkey PRIMARY KEY (id);


--
-- Name: acl pk_acl; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acl
    ADD CONSTRAINT pk_acl PRIMARY KEY (idpapel, idrecurso);


--
-- Name: agenda pk_agenda; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda
    ADD CONSTRAINT pk_agenda PRIMARY KEY (idagenda);


--
-- Name: agenda_extras pk_agenda_extras; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_extras
    ADD CONSTRAINT pk_agenda_extras PRIMARY KEY (idagenda, idcliente);


--
-- Name: socio pk_agingresso; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.socio
    ADD CONSTRAINT pk_agingresso PRIMARY KEY (cpf);


--
-- Name: compra pk_compra; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compra
    ADD CONSTRAINT pk_compra PRIMARY KEY (idcompra);


--
-- Name: conveniado pk_conveniado; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conveniado
    ADD CONSTRAINT pk_conveniado PRIMARY KEY (idconvenio, cpf);


--
-- Name: convenio pk_convenio; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio
    ADD CONSTRAINT pk_convenio PRIMARY KEY (idconvenio);


--
-- Name: email pk_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email
    ADD CONSTRAINT pk_email PRIMARY KEY (idemail);


--
-- Name: escoladata pk_escoladata; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escoladata
    ADD CONSTRAINT pk_escoladata PRIMARY KEY (idescola, idagenda);


--
-- Name: pagpagseguro pk_pagpagseguro; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagpagseguro
    ADD CONSTRAINT pk_pagpagseguro PRIMARY KEY (idcompra, idpagseguro);


--
-- Name: papel pk_papel; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.papel
    ADD CONSTRAINT pk_papel PRIMARY KEY (idpapel);


--
-- Name: tabpreco pk_precos; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tabpreco
    ADD CONSTRAINT pk_precos PRIMARY KEY (idtabpreco);


--
-- Name: trocasenha pk_trocasenha; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trocasenha
    ADD CONSTRAINT pk_trocasenha PRIMARY KEY (idtrocasenha);


--
-- Name: usuario pk_usuario; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT pk_usuario PRIMARY KEY (cpf);


--
-- Name: sociocateg pk_venda; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sociocateg
    ADD CONSTRAINT pk_venda PRIMARY KEY (idsociocateg);


--
-- Name: uf uf_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.uf
    ADD CONSTRAINT uf_pkey PRIMARY KEY (iduf);


--
-- Name: usuario uq_usuario_cpf; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT uq_usuario_cpf UNIQUE (cpf);


--
-- Name: voucher uq_voucher_numvoucher; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher
    ADD CONSTRAINT uq_voucher_numvoucher UNIQUE (numvoucher);


--
-- Name: voucher voucher_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher
    ADD CONSTRAINT voucher_pkey PRIMARY KEY (idvoucher);


--
-- Name: agenda_extras_bak_20251112_idagenda_idcliente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agenda_extras_bak_20251112_idagenda_idcliente_idx ON public.agenda_extras_bak_20251112 USING btree (idagenda, idcliente);


--
-- Name: idx_agenda_extras_agenda_cli; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agenda_extras_agenda_cli ON public.agenda_extras USING btree (idagenda, idcliente);


--
-- Name: idx_agenda_faixas_agenda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agenda_faixas_agenda ON public.agenda_faixas USING btree (idagenda);


--
-- Name: idx_agenda_faixas_agenda_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agenda_faixas_agenda_cliente ON public.agenda_faixas USING btree (idagenda, idcliente);


--
-- Name: idx_agenda_faixas_intervalo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agenda_faixas_intervalo ON public.agenda_faixas USING btree (idagenda, idade_min, idade_max);


--
-- Name: idx_caixa_periodos_fechado_em; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_caixa_periodos_fechado_em ON public.caixa_periodos USING btree (fechado_em);


--
-- Name: idx_clientes_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_id ON public.clientes USING btree (idcliente);


--
-- Name: idx_clientes_nome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_nome ON public.clientes USING btree (nome);


--
-- Name: idx_clientes_tipo_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_tipo_status ON public.clientes USING btree (idtipo, status);


--
-- Name: idx_codindica_cashback_codindica; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_codindica_cashback_codindica ON public.codindica_cashback USING btree (codindica, stcashback);


--
-- Name: idx_compra_cpf_tpcompra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compra_cpf_tpcompra_id ON public.compra USING btree (cpf, tpcompra, idcompra DESC);


--
-- Name: idx_edicoes_log_box_office_idempotency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edicoes_log_box_office_idempotency ON public.edicoes_log USING btree ((((NULLIF(detalhes_json, ''::text))::jsonb ->> 'idempotencyKey'::text))) WHERE (((origem)::text = 'ops-box-office'::text) AND ((acao)::text = 'sale_create'::text) AND (detalhes_json IS NOT NULL));


--
-- Name: idx_edicoes_log_compra_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edicoes_log_compra_id ON public.edicoes_log USING btree (compra_id);


--
-- Name: idx_edicoes_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edicoes_log_created_at ON public.edicoes_log USING btree (created_at DESC);


--
-- Name: idx_edicoes_log_folha_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edicoes_log_folha_id ON public.edicoes_log USING btree (folha_id);


--
-- Name: idx_edicoes_log_periodo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edicoes_log_periodo_id ON public.edicoes_log USING btree (periodo_id);


--
-- Name: idx_movcaixa_data_hora; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movcaixa_data_hora ON public.movimentacao_caixa USING btree (data_hora);


--
-- Name: idx_movcaixa_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movcaixa_tipo ON public.movimentacao_caixa USING btree (tipo);


--
-- Name: idx_movimentacao_caixa_tipo_data_hora; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_movimentacao_caixa_tipo_data_hora ON public.movimentacao_caixa USING btree (tipo, data_hora DESC);


--
-- Name: idx_pagto_compra; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pagto_compra ON public.compra_pagamentos USING btree (idcompra);


--
-- Name: idx_people_in_park_periodo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_people_in_park_periodo ON public.people_in_park USING btree (periodo_id);


--
-- Name: idx_voucher_desconto_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_desconto_id ON public.voucher USING btree (desconto_id);


--
-- Name: idx_voucher_dtuso; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_dtuso ON public.voucher USING btree (dtuso);


--
-- Name: idx_voucher_dtvalidade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_dtvalidade ON public.voucher USING btree (dtvalidade);


--
-- Name: idx_voucher_ensino_ano; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_ensino_ano ON public.voucher USING btree (ensino_ano);


--
-- Name: idx_voucher_ensino_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_ensino_tipo ON public.voucher USING btree (ensino_tipo);


--
-- Name: idx_voucher_escol_compra_agenda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_escol_compra_agenda ON public.voucher USING btree (tpvoucher, idcompra, idagenda);


--
-- Name: idx_voucher_idcompra_stusado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_idcompra_stusado ON public.voucher USING btree (idcompra, stusado);


--
-- Name: idx_voucher_periodo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_periodo_id ON public.voucher USING btree (periodo_id);


--
-- Name: idx_voucher_tpvoucher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_tpvoucher ON public.voucher USING btree (tpvoucher);


--
-- Name: idx_voucher_turma_letra; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_turma_letra ON public.voucher USING btree (turma_letra);


--
-- Name: ix_esp_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_esp_ativo ON public.ingressos_especiais USING btree (ativo);


--
-- Name: ix_esp_tipo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_esp_tipo_id ON public.ingressos_especiais USING btree (tipo_id);


--
-- Name: ix_esp_tipos_ativo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_esp_tipos_ativo ON public.ingressos_especiais_tipos USING btree (ativo);


--
-- Name: ix_esp_tipos_descricao; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_esp_tipos_descricao ON public.ingressos_especiais_tipos USING btree (descricao);


--
-- Name: ix_esp_valor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_esp_valor ON public.ingressos_especiais USING btree (valor);


--
-- Name: ux_cliente_tipos_nome_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_cliente_tipos_nome_ci ON public.cliente_tipos USING btree (lower(nome));


--
-- Name: ux_clientes_nome_tipo_ci; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ux_clientes_nome_tipo_ci ON public.clientes USING btree (lower(btrim(nome)), idtipo);


--
-- Name: agenda_faixas agenda_faixas_idagenda_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agenda_faixas
    ADD CONSTRAINT agenda_faixas_idagenda_fkey FOREIGN KEY (idagenda) REFERENCES public.agenda(idagenda) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: caixa_periodos caixa_periodos_folha_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.caixa_periodos
    ADD CONSTRAINT caixa_periodos_folha_id_fkey FOREIGN KEY (folha_id) REFERENCES public.caixa_fechamentos(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: cliente_turma_periodos cliente_turma_periodos_idturma_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_turma_periodos
    ADD CONSTRAINT cliente_turma_periodos_idturma_fkey FOREIGN KEY (idturma) REFERENCES public.cliente_turmas(idturma) ON DELETE CASCADE;


--
-- Name: cliente_turmas cliente_turmas_idcliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cliente_turmas
    ADD CONSTRAINT cliente_turmas_idcliente_fkey FOREIGN KEY (idcliente) REFERENCES public.clientes(idcliente) ON DELETE CASCADE;


--
-- Name: clientes clientes_idtipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_idtipo_fkey FOREIGN KEY (idtipo) REFERENCES public.cliente_tipos(idtipo) ON UPDATE RESTRICT ON DELETE RESTRICT;


--
-- Name: descontos descontos_tipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.descontos
    ADD CONSTRAINT descontos_tipo_id_fkey FOREIGN KEY (tipo_id) REFERENCES public.descontos_tipos(id) ON UPDATE CASCADE;


--
-- Name: acl fk_acl_papel; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acl
    ADD CONSTRAINT fk_acl_papel FOREIGN KEY (idpapel) REFERENCES public.papel(idpapel);


--
-- Name: cidade fk_cidade_uf; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cidade
    ADD CONSTRAINT fk_cidade_uf FOREIGN KEY (iduf) REFERENCES public.uf(iduf);


--
-- Name: compra fk_compra_codindica; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compra
    ADD CONSTRAINT fk_compra_codindica FOREIGN KEY (codindica) REFERENCES public.codindica(codindica);


--
-- Name: compra fk_compra_usuario; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compra
    ADD CONSTRAINT fk_compra_usuario FOREIGN KEY (cpf) REFERENCES public.usuario(cpf);


--
-- Name: conveniado fk_conveniado_convenio; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conveniado
    ADD CONSTRAINT fk_conveniado_convenio FOREIGN KEY (idconvenio) REFERENCES public.convenio(idconvenio);


--
-- Name: convenio fk_convenio_tabpreco; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.convenio
    ADD CONSTRAINT fk_convenio_tabpreco FOREIGN KEY (idtabpreco) REFERENCES public.tabpreco(idtabpreco);


--
-- Name: escoladata fk_escoladata_agenda; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escoladata
    ADD CONSTRAINT fk_escoladata_agenda FOREIGN KEY (idagenda) REFERENCES public.agenda(idagenda);


--
-- Name: escoladata fk_escoladata_escola; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.escoladata
    ADD CONSTRAINT fk_escoladata_escola FOREIGN KEY (idescola) REFERENCES public.escola(idescola);


--
-- Name: pagpagseguro fk_pagpagseguro_compra; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagpagseguro
    ADD CONSTRAINT fk_pagpagseguro_compra FOREIGN KEY (idcompra) REFERENCES public.compra(idcompra);


--
-- Name: compra_pagamentos fk_pagto_compra; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compra_pagamentos
    ADD CONSTRAINT fk_pagto_compra FOREIGN KEY (idcompra) REFERENCES public.compra(idcompra) ON DELETE CASCADE;


--
-- Name: socio fk_socio_sociocateg; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.socio
    ADD CONSTRAINT fk_socio_sociocateg FOREIGN KEY (idsociocateg) REFERENCES public.sociocateg(idsociocateg);


--
-- Name: sociocateg fk_sociocateg_tabpreco; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sociocateg
    ADD CONSTRAINT fk_sociocateg_tabpreco FOREIGN KEY (idtabpreco) REFERENCES public.tabpreco(idtabpreco);


--
-- Name: usuario fk_usuario_papel; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuario
    ADD CONSTRAINT fk_usuario_papel FOREIGN KEY (idpapel) REFERENCES public.papel(idpapel);


--
-- Name: voucher fk_voucher_agenda; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher
    ADD CONSTRAINT fk_voucher_agenda FOREIGN KEY (idagenda) REFERENCES public.agenda(idagenda);


--
-- Name: voucher fk_voucher_autorizado; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher
    ADD CONSTRAINT fk_voucher_autorizado FOREIGN KEY (autorizado_por_id) REFERENCES public.cortesias(id);


--
-- Name: voucher fk_voucher_codindica; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher
    ADD CONSTRAINT fk_voucher_codindica FOREIGN KEY (codindica) REFERENCES public.codindica(codindica);


--
-- Name: voucher fk_voucher_compra; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher
    ADD CONSTRAINT fk_voucher_compra FOREIGN KEY (idcompra) REFERENCES public.compra(idcompra);


--
-- Name: voucher fk_voucher_desconto; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher
    ADD CONSTRAINT fk_voucher_desconto FOREIGN KEY (desconto_id) REFERENCES public.descontos(id);


--
-- Name: voucher fk_voucher_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher
    ADD CONSTRAINT fk_voucher_item FOREIGN KEY (item_id) REFERENCES public.ingressos_especiais(id);


--
-- Name: voucher fk_voucher_periodo; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher
    ADD CONSTRAINT fk_voucher_periodo FOREIGN KEY (periodo_id) REFERENCES public.caixa_periodos(id);


--
-- Name: ingressos_especiais ingressos_especiais_tipo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingressos_especiais
    ADD CONSTRAINT ingressos_especiais_tipo_id_fkey FOREIGN KEY (tipo_id) REFERENCES public.ingressos_especiais_tipos(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict qlXZhUaSuUaFyCAXBiIcaTyL8qMvx6Djh9kcqEJiDy8g9tpt8XJ8hAtFistes2u

