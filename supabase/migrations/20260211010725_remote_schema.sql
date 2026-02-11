


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


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";





SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."criteria" (
    "id" integer NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "age_min" integer NOT NULL,
    "age_max" integer,
    "activation_level" "text" NOT NULL,
    "notes" "text",
    CONSTRAINT "criteria_activation_level_check" CHECK (("activation_level" = ANY (ARRAY['Level 1'::"text", 'Level 2'::"text", 'Level 3'::"text"]))),
    CONSTRAINT "criteria_age_max_check" CHECK (("age_max" >= 0)),
    CONSTRAINT "criteria_age_min_check" CHECK (("age_min" >= 0)),
    CONSTRAINT "criteria_category_check" CHECK (("category" = ANY (ARRAY['Adult'::"text", 'Pediatric'::"text", 'Geriatric'::"text"])))
);


ALTER TABLE "public"."criteria" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."criteria_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."criteria_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."criteria_id_seq" OWNED BY "public"."criteria"."id";



CREATE TABLE IF NOT EXISTS "public"."examples" (
    "id" integer NOT NULL,
    "criteria_id" integer,
    "mechanism" "text" NOT NULL,
    "descriptors" "text",
    "age" integer NOT NULL,
    "gender" "text",
    "gcs" integer,
    "systolic_bp" integer,
    "heart_rate" integer,
    "respiratory_rate" integer,
    "airway" "text",
    "breathing" "text",
    "oxygen_saturation" integer,
    "pregnancy_in_weeks" integer,
    CONSTRAINT "examples_airway_check" CHECK (("airway" = ANY (ARRAY['patent'::"text", 'intubated'::"text", 'extraglottic'::"text", 'compromised'::"text"]))),
    CONSTRAINT "examples_breathing_check" CHECK (("breathing" = ANY (ARRAY['Breathing Independently'::"text", 'Bagging'::"text", 'Ventilator'::"text"]))),
    CONSTRAINT "examples_gender_check" CHECK (("gender" = ANY (ARRAY['male'::"text", 'female'::"text"])))
);


ALTER TABLE "public"."examples" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."examples_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."examples_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."examples_id_seq" OWNED BY "public"."examples"."id";



ALTER TABLE ONLY "public"."criteria" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."criteria_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."examples" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."examples_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."criteria"
    ADD CONSTRAINT "criteria_description_category_age_min_age_max_activation_le_key" UNIQUE ("description", "category", "age_min", "age_max", "activation_level");



ALTER TABLE ONLY "public"."criteria"
    ADD CONSTRAINT "criteria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."examples"
    ADD CONSTRAINT "examples_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."examples"
    ADD CONSTRAINT "examples_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "public"."criteria"("id") ON DELETE CASCADE;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;
























































































































SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;

































SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;






SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;









GRANT ALL ON TABLE "public"."criteria" TO "anon";
GRANT ALL ON TABLE "public"."criteria" TO "authenticated";
GRANT ALL ON TABLE "public"."criteria" TO "service_role";



GRANT ALL ON SEQUENCE "public"."criteria_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."criteria_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."criteria_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."examples" TO "anon";
GRANT ALL ON TABLE "public"."examples" TO "authenticated";
GRANT ALL ON TABLE "public"."examples" TO "service_role";



GRANT ALL ON SEQUENCE "public"."examples_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."examples_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."examples_id_seq" TO "service_role";



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



SET SESSION AUTHORIZATION "postgres";
RESET SESSION AUTHORIZATION;



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































drop extension if exists "pg_net";

alter table "public"."criteria" enable row level security;

alter table "public"."examples" enable row level security;


