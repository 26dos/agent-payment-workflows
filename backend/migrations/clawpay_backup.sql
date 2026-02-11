--
-- PostgreSQL database dump
--

\restrict gTlgHEfwgHlZbff02EFNO5vFduUOv4oshBxJqA583lhqtODotckQ0w8B6kdAbYf

-- Dumped from database version 16.11 (Homebrew)
-- Dumped by pg_dump version 16.11 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: jiangdanhui
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO jiangdanhui;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: jiangdanhui
--

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    task_id integer,
    agent_did character varying(66) NOT NULL,
    action character varying(50) NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.activity_logs OWNER TO jiangdanhui;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: jiangdanhui
--

CREATE SEQUENCE public.activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.activity_logs_id_seq OWNER TO jiangdanhui;

--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jiangdanhui
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: agents; Type: TABLE; Schema: public; Owner: jiangdanhui
--

CREATE TABLE public.agents (
    id integer NOT NULL,
    user_id integer,
    name character varying(100) NOT NULL,
    sub_did character varying(66),
    agent_score integer DEFAULT 75,
    daily_limit numeric(20,6),
    single_limit numeric(20,6),
    mandate_expiry timestamp with time zone,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.agents OWNER TO jiangdanhui;

--
-- Name: agents_id_seq; Type: SEQUENCE; Schema: public; Owner: jiangdanhui
--

CREATE SEQUENCE public.agents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.agents_id_seq OWNER TO jiangdanhui;

--
-- Name: agents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jiangdanhui
--

ALTER SEQUENCE public.agents_id_seq OWNED BY public.agents.id;


--
-- Name: disputes; Type: TABLE; Schema: public; Owner: jiangdanhui
--

CREATE TABLE public.disputes (
    id integer NOT NULL,
    task_id integer,
    raised_by_did character varying(66) NOT NULL,
    reason text NOT NULL,
    requester_percent integer,
    resolved boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone
);


ALTER TABLE public.disputes OWNER TO jiangdanhui;

--
-- Name: disputes_id_seq; Type: SEQUENCE; Schema: public; Owner: jiangdanhui
--

CREATE SEQUENCE public.disputes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.disputes_id_seq OWNER TO jiangdanhui;

--
-- Name: disputes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jiangdanhui
--

ALTER SEQUENCE public.disputes_id_seq OWNED BY public.disputes.id;


--
-- Name: reputation_history; Type: TABLE; Schema: public; Owner: jiangdanhui
--

CREATE TABLE public.reputation_history (
    id integer NOT NULL,
    did character varying(66) NOT NULL,
    is_human boolean NOT NULL,
    old_score integer NOT NULL,
    new_score integer NOT NULL,
    reason character varying(255) NOT NULL,
    task_id integer,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.reputation_history OWNER TO jiangdanhui;

--
-- Name: reputation_history_id_seq; Type: SEQUENCE; Schema: public; Owner: jiangdanhui
--

CREATE SEQUENCE public.reputation_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reputation_history_id_seq OWNER TO jiangdanhui;

--
-- Name: reputation_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jiangdanhui
--

ALTER SEQUENCE public.reputation_history_id_seq OWNED BY public.reputation_history.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: jiangdanhui
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    chain_task_id bigint,
    requester_did character varying(66) NOT NULL,
    provider_did character varying(66) NOT NULL,
    base_amount numeric(20,6) NOT NULL,
    final_amount numeric(20,6) NOT NULL,
    insurance_premium numeric(20,6) DEFAULT 0,
    complexity smallint NOT NULL,
    status character varying(20) DEFAULT 'created'::character varying NOT NULL,
    metadata text DEFAULT ''::text,
    tx_hash character varying(66),
    created_at timestamp with time zone DEFAULT now(),
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    expiry_time timestamp with time zone NOT NULL,
    CONSTRAINT tasks_complexity_check CHECK (((complexity >= 1) AND (complexity <= 3)))
);


ALTER TABLE public.tasks OWNER TO jiangdanhui;

--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: jiangdanhui
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO jiangdanhui;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jiangdanhui
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: jiangdanhui
--

CREATE TABLE public.users (
    id integer NOT NULL,
    wallet_address character varying(42) NOT NULL,
    did character varying(66),
    human_score integer DEFAULT 75,
    metadata text DEFAULT '{}'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO jiangdanhui;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: jiangdanhui
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO jiangdanhui;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: jiangdanhui
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: agents id; Type: DEFAULT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.agents ALTER COLUMN id SET DEFAULT nextval('public.agents_id_seq'::regclass);


--
-- Name: disputes id; Type: DEFAULT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.disputes ALTER COLUMN id SET DEFAULT nextval('public.disputes_id_seq'::regclass);


--
-- Name: reputation_history id; Type: DEFAULT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.reputation_history ALTER COLUMN id SET DEFAULT nextval('public.reputation_history_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: jiangdanhui
--

COPY public.activity_logs (id, task_id, agent_did, action, details, created_at) FROM stdin;
\.


--
-- Data for Name: agents; Type: TABLE DATA; Schema: public; Owner: jiangdanhui
--

COPY public.agents (id, user_id, name, sub_did, agent_score, daily_limit, single_limit, mandate_expiry, status, created_at, updated_at) FROM stdin;
1	1	Trading Bot Alpha		75	10000.000000	1000.000000	2026-03-10 15:47:00+08	active	2026-02-10 15:38:06.971711+08	2026-02-10 15:47:28.65459+08
2	2	m y s q		75	0.000000	0.000000	\N	active	2026-02-10 16:08:04.860205+08	2026-02-10 16:08:04.860205+08
3	3	my-trade-bot	0x41d3c07dc0f2858d876d995b342cb6ba386a16c7114da59d1886c0d871b61e55	75	10000.000000	1000.000000	2026-03-10 17:14:00+08	active	2026-02-10 17:14:14.811279+08	2026-02-10 17:42:27.285114+08
\.


--
-- Data for Name: disputes; Type: TABLE DATA; Schema: public; Owner: jiangdanhui
--

COPY public.disputes (id, task_id, raised_by_did, reason, requester_percent, resolved, created_at, resolved_at) FROM stdin;
1	4		Synced from blockchain	\N	f	2026-02-10 23:44:12.854973+08	\N
2	4		Synced from blockchain	\N	f	2026-02-10 23:44:12.901456+08	\N
\.


--
-- Data for Name: reputation_history; Type: TABLE DATA; Schema: public; Owner: jiangdanhui
--

COPY public.reputation_history (id, did, is_human, old_score, new_score, reason, task_id, created_at) FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: jiangdanhui
--

COPY public.tasks (id, chain_task_id, requester_did, provider_did, base_amount, final_amount, insurance_premium, complexity, status, metadata, tx_hash, created_at, accepted_at, completed_at, expiry_time) FROM stdin;
1	\N	0x41d3c07dc0f2858d876d995b342cb6ba386a16c7114da59d1886c0d871b61e55	0x87c8b7e4fa11b70548f38b43f82b4556485968c3d916b1bd4160defdfad02a32	100.000000	100.000000	0.000000	1	completed	On-chain task (tx: 0x44f3ff88...)		2026-02-10 17:33:10.041026+08	2026-02-10 17:37:23.321764+08	2026-02-10 17:37:26.134393+08	2026-02-17 17:33:10.03513+08
2	\N	0x41d3c07dc0f2858d876d995b342cb6ba386a16c7114da59d1886c0d871b61e55	0x87c8b7e4fa11b70548f38b43f82b4556485968c3d916b1bd4160defdfad02a32	100.000000	150.000000	0.000000	2	completed	On-chain task (tx: 0xfb3c7161...)		2026-02-10 17:47:44.509623+08	2026-02-10 17:47:54.317304+08	2026-02-10 17:47:56.261443+08	2026-02-17 17:47:44.508898+08
3	3	0x41d3c07dc0f2858d876d995b342cb6ba386a16c7114da59d1886c0d871b61e55	0x87c8b7e4fa11b70548f38b43f82b4556485968c3d916b1bd4160defdfad02a32	100.000000	250.000000	0.000000	3	completed	On-chain task (tx: 0x69be58cf...)	0x69be58cf000d94be92c7d56036b0a1d050b599d9569a4a83cbe1d4c1739e8065	2026-02-10 17:51:36.168462+08	2026-02-10 18:01:01.371345+08	2026-02-10 18:17:12.831731+08	2026-02-17 17:51:36.16683+08
4	4	0x41d3c07dc0f2858d876d995b342cb6ba386a16c7114da59d1886c0d871b61e55	0x87c8b7e4fa11b70548f38b43f82b4556485968c3d916b1bd4160defdfad02a32	100.000000	100.000000	0.000000	1	disputed	On-chain task (tx: 0xa1f414bc...)	0xa1f414bca5fec80cc3544335644060d7c257664185af44d49655b81c6213f5b7	2026-02-10 23:31:51.064321+08	2026-02-10 23:35:42.907404+08	\N	2026-02-17 23:31:51.063146+08
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: jiangdanhui
--

COPY public.users (id, wallet_address, did, human_score, metadata, created_at, updated_at) FROM stdin;
1	0xB5588EEAfeeb87dC21Be17B79EcC77E0908d3d1d		75	{}	2026-02-10 15:07:13.504115+08	2026-02-10 15:07:13.504115+08
2	0x1822e69b04640202f02F3c753474a758154a6990		75	{}	2026-02-10 16:07:49.929285+08	2026-02-10 16:07:49.929285+08
3	0xd68cC5807d9573A17B731Dd7a056fe9DA3cfbCa9		75	{}	2026-02-10 17:01:28.76817+08	2026-02-10 17:01:28.76817+08
\.


--
-- Name: activity_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jiangdanhui
--

SELECT pg_catalog.setval('public.activity_logs_id_seq', 1, false);


--
-- Name: agents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jiangdanhui
--

SELECT pg_catalog.setval('public.agents_id_seq', 3, true);


--
-- Name: disputes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jiangdanhui
--

SELECT pg_catalog.setval('public.disputes_id_seq', 2, true);


--
-- Name: reputation_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jiangdanhui
--

SELECT pg_catalog.setval('public.reputation_history_id_seq', 1, false);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jiangdanhui
--

SELECT pg_catalog.setval('public.tasks_id_seq', 4, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: jiangdanhui
--

SELECT pg_catalog.setval('public.users_id_seq', 3, true);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);


--
-- Name: disputes disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_pkey PRIMARY KEY (id);


--
-- Name: reputation_history reputation_history_pkey; Type: CONSTRAINT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.reputation_history
    ADD CONSTRAINT reputation_history_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_wallet_address_key; Type: CONSTRAINT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_wallet_address_key UNIQUE (wallet_address);


--
-- Name: idx_activity_agent; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_activity_agent ON public.activity_logs USING btree (agent_did);


--
-- Name: idx_activity_created; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_activity_created ON public.activity_logs USING btree (created_at DESC);


--
-- Name: idx_activity_task; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_activity_task ON public.activity_logs USING btree (task_id);


--
-- Name: idx_agents_did; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_agents_did ON public.agents USING btree (sub_did);


--
-- Name: idx_agents_status; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_agents_status ON public.agents USING btree (status);


--
-- Name: idx_agents_user; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_agents_user ON public.agents USING btree (user_id);


--
-- Name: idx_disputes_resolved; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_disputes_resolved ON public.disputes USING btree (resolved);


--
-- Name: idx_disputes_task; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_disputes_task ON public.disputes USING btree (task_id);


--
-- Name: idx_reputation_created; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_reputation_created ON public.reputation_history USING btree (created_at DESC);


--
-- Name: idx_reputation_did; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_reputation_did ON public.reputation_history USING btree (did);


--
-- Name: idx_tasks_chain_id; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_tasks_chain_id ON public.tasks USING btree (chain_task_id);


--
-- Name: idx_tasks_created; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_tasks_created ON public.tasks USING btree (created_at DESC);


--
-- Name: idx_tasks_provider; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_tasks_provider ON public.tasks USING btree (provider_did);


--
-- Name: idx_tasks_requester; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_tasks_requester ON public.tasks USING btree (requester_did);


--
-- Name: idx_tasks_status; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_tasks_status ON public.tasks USING btree (status);


--
-- Name: idx_users_did; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_users_did ON public.users USING btree (did);


--
-- Name: idx_users_wallet; Type: INDEX; Schema: public; Owner: jiangdanhui
--

CREATE INDEX idx_users_wallet ON public.users USING btree (wallet_address);


--
-- Name: agents update_agents_updated_at; Type: TRIGGER; Schema: public; Owner: jiangdanhui
--

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: jiangdanhui
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: activity_logs activity_logs_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: agents agents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: disputes disputes_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.disputes
    ADD CONSTRAINT disputes_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: reputation_history reputation_history_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: jiangdanhui
--

ALTER TABLE ONLY public.reputation_history
    ADD CONSTRAINT reputation_history_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id);


--
-- PostgreSQL database dump complete
--

\unrestrict gTlgHEfwgHlZbff02EFNO5vFduUOv4oshBxJqA583lhqtODotckQ0w8B6kdAbYf

