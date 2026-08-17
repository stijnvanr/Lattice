import { METAMODEL_ID, SCHEMA_VERSION } from "@/schema/common";
import type { Bundle } from "@/schema/bundle";
import type { Component } from "@/schema/component";
import type { Diagram } from "@/schema/diagram";
import type { Page, TiptapDoc, TiptapNode } from "@/schema/page";
import { emptyDoc } from "@/schema/page";
import type { Reference } from "@/schema/reference";
import type { Workspace } from "@/schema/workspace";
import { createId, nowIso, slugify } from "@/lib/ids";

const T = "2026-08-17T09:00:00.000Z";

function text(value: string): TiptapNode {
  return { type: "text", text: value };
}

function mention(id: string, label: string): TiptapNode {
  return {
    type: "mention",
    attrs: { id, label, mentionType: "component" },
  };
}

function paragraph(...content: TiptapNode[]): TiptapNode {
  return { type: "paragraph", content };
}

function heading(level: 1 | 2, value: string): TiptapNode {
  return {
    type: "heading",
    attrs: { level },
    content: [text(value)],
  };
}

function listItem(...content: TiptapNode[]): TiptapNode {
  return { type: "listItem", content: [paragraph(...content)] };
}

function bullets(...items: TiptapNode[][]): TiptapNode {
  return { type: "bulletList", content: items.map((parts) => listItem(...parts)) };
}

function task(checked: boolean, ...content: TiptapNode[]): TiptapNode {
  return {
    type: "taskItem",
    attrs: { checked },
    content: [paragraph(...content)],
  };
}

function tasks(...items: TiptapNode[]): TiptapNode {
  return { type: "taskList", content: items };
}

function doc(...content: TiptapNode[]): TiptapDoc {
  return { type: "doc", content };
}

function workspace(
  partial: Omit<Workspace, "metamodelId" | "createdAt" | "updatedAt" | "slug"> & { slug?: string },
): Workspace {
  return {
    ...partial,
    slug: partial.slug ?? slugify(partial.name),
    metamodelId: METAMODEL_ID,
    createdAt: T,
    updatedAt: T,
  };
}

function base(
  id: string,
  workspaceId: string,
  name: string,
  description: string,
  extra?: { parentId?: string; ownerId?: string; status?: Component["status"]; tags?: string[] },
) {
  return {
    id,
    workspaceId,
    name,
    description,
    status: extra?.status ?? ("active" as const),
    tags: extra?.tags ?? [],
    parentId: extra?.parentId,
    ownerId: extra?.ownerId,
    createdAt: T,
    updatedAt: T,
  };
}

function ref(
  id: string,
  workspaceId: string,
  type: Reference["type"],
  sourceId: string,
  targetId: string,
  extra?: { viaId?: string; description?: string },
): Reference {
  return {
    id,
    workspaceId,
    type,
    sourceId,
    targetId,
    viaId: extra?.viaId,
    description: extra?.description,
    createdAt: T,
    updatedAt: T,
  };
}

function wikiPage(
  id: string,
  workspaceId: string,
  title: string,
  order: number,
  pageDoc: TiptapDoc,
  parentId?: string,
): Page {
  return {
    id,
    workspaceId,
    parentId,
    title,
    slug: slugify(title),
    order,
    doc: pageDoc,
    createdAt: T,
    updatedAt: T,
  };
}

function autoPage(workspaceId: string, component: Component, order: number, pageDoc?: TiptapDoc): Page {
  return {
    id: `pg_auto_${component.id.replace(/^cmp_/, "")}`,
    workspaceId,
    title: component.name,
    slug: slugify(component.name),
    order,
    doc: pageDoc ?? (component.description ? doc(paragraph(text(component.description))) : emptyDoc()),
    componentId: component.id,
    createdAt: T,
    updatedAt: T,
  };
}

export function buildEmptyWorkspace(name = "Untitled"): Bundle {
  const id = createId("workspace");
  const createdAt = nowIso();
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: createdAt,
    workspace: {
      id,
      name,
      description: "",
      slug: slugify(name),
      metamodelId: METAMODEL_ID,
      createdAt,
      updatedAt: createdAt,
    },
    components: [],
    references: [],
    pages: [],
    diagrams: [],
  };
}

/** Sample product workspace shipped with Lattice. Also used as the test fixture. */
export function buildSampleWorkspace(): Bundle {
  const ws = "ws_northstar";
  const org = "cmp_org";
  const ava = "cmp_ava";
  const sam = "cmp_sam";
  const acquire = "cmp_acquire";
  const selfserve = "cmp_selfserve";
  const deliver = "cmp_deliver";
  const workspaceCap = "cmp_workspace";
  const invoicing = "cmp_invoicing";
  const getpaid = "cmp_getpaid";
  const payments = "cmp_payments";
  const dunning = "cmp_dunning";
  const wfSignup = "cmp_wf_signup";
  const wfAccount = "cmp_wf_account";
  const wfEmail = "cmp_wf_email";
  const wfFirstWs = "cmp_wf_first_ws";
  const wfInvoice = "cmp_wf_invoice";
  const wfDraft = "cmp_wf_draft";
  const wfSend = "cmp_wf_send";
  const wfCollect = "cmp_wf_collect";
  const wfLink = "cmp_wf_link";
  const wfWebhook = "cmp_wf_webhook";
  const prQ2c = "cmp_pr_q2c";
  const prClose = "cmp_pr_close";
  const web = "cmp_web";
  const stripe = "cmp_stripe";
  const postmark = "cmp_postmark";
  const stripeApi = "cmp_stripe_api";
  const postgres = "cmp_postgres";
  const vercel = "cmp_vercel";

  const wsObj = workspace({
    id: ws,
    name: "Northstar",
    description:
      "Sample product workspace: an invoicing SaaS for independent consultants. Capabilities and workflows are the client story. Applications, interfaces, and technology are the delivery story.",
  });

  const components: Component[] = [
    {
      ...base(org, ws, "Northstar", "The company that builds the invoicing product."),
      type: "organization",
    },
    {
      ...base(ava, ws, "Ava Chen", "Product lead. Owns how customers get from first visit to first payment."),
      type: "person",
      email: "ava@northstar.example",
      role: "Head of Product",
    },
    {
      ...base(sam, ws, "Sam Okonkwo", "Engineering lead. Owns the web app, billing integration, and runtime."),
      type: "person",
      email: "sam@northstar.example",
      role: "Head of Engineering",
    },
    {
      ...base(acquire, ws, "Acquire", "Turn a visitor into a workspace that can send an invoice.", {
        ownerId: ava,
      }),
      type: "capability",
      level: 1,
    },
    {
      ...base(selfserve, ws, "Self-serve signup", "A consultant can create an account without talking to sales.", {
        parentId: acquire,
        ownerId: ava,
      }),
      type: "capability",
      level: 2,
    },
    {
      ...base(deliver, ws, "Deliver", "Run the product: workspace, invoices, and sending.", { ownerId: sam }),
      type: "capability",
      level: 1,
    },
    {
      ...base(workspaceCap, ws, "Workspace", "A consultant has a place for clients, invoices, and settings.", {
        parentId: deliver,
        ownerId: sam,
      }),
      type: "capability",
      level: 2,
    },
    {
      ...base(invoicing, ws, "Invoicing", "Create, send, and track invoices.", {
        parentId: deliver,
        ownerId: sam,
      }),
      type: "capability",
      level: 2,
    },
    {
      ...base(getpaid, ws, "Get paid", "Money arrives, is reconciled, and overdue invoices are followed up.", {
        ownerId: ava,
      }),
      type: "capability",
      level: 1,
    },
    {
      ...base(payments, ws, "Payments", "A client can pay an invoice online.", {
        parentId: getpaid,
        ownerId: ava,
      }),
      type: "capability",
      level: 2,
    },
    {
      ...base(dunning, ws, "Collections", "Unpaid invoices get a reminder instead of being forgotten.", {
        parentId: getpaid,
        ownerId: ava,
      }),
      type: "capability",
      level: 2,
    },
    {
      ...base(wfSignup, ws, "Sign up", "The product flow from empty browser to a usable workspace.", {
        ownerId: ava,
      }),
      type: "workflow",
    },
    {
      ...base(wfAccount, ws, "Create account", "Email, password, and display name.", {
        parentId: wfSignup,
        ownerId: ava,
      }),
      type: "workflow",
    },
    {
      ...base(wfEmail, ws, "Confirm email", "Prove the mailbox works before the workspace is trusted.", {
        parentId: wfSignup,
        ownerId: ava,
      }),
      type: "workflow",
    },
    {
      ...base(wfFirstWs, ws, "Create workspace", "Name the studio and land on an empty invoice list.", {
        parentId: wfSignup,
        ownerId: sam,
      }),
      type: "workflow",
    },
    {
      ...base(wfInvoice, ws, "Send an invoice", "The product flow from a blank invoice to a mail in the client inbox.", {
        ownerId: sam,
      }),
      type: "workflow",
    },
    {
      ...base(wfDraft, ws, "Draft invoice", "Line items, due date, and client.", {
        parentId: wfInvoice,
        ownerId: sam,
      }),
      type: "workflow",
    },
    {
      ...base(wfSend, ws, "Send invoice", "Email the PDF and a payment link.", {
        parentId: wfInvoice,
        ownerId: sam,
      }),
      type: "workflow",
    },
    {
      ...base(wfCollect, ws, "Collect payment", "The product flow from payment link to a paid invoice.", {
        ownerId: ava,
      }),
      type: "workflow",
    },
    {
      ...base(wfLink, ws, "Open payment link", "Client opens the hosted checkout for that invoice.", {
        parentId: wfCollect,
        ownerId: ava,
      }),
      type: "workflow",
    },
    {
      ...base(wfWebhook, ws, "Mark invoice paid", "A webhook from the processor closes the invoice.", {
        parentId: wfCollect,
        ownerId: sam,
      }),
      type: "workflow",
    },
    {
      ...base(prQ2c, ws, "Quote to cash", "Operating process from agreed work to cash in the bank.", {
        ownerId: ava,
      }),
      type: "process",
    },
    {
      ...base(prClose, ws, "Month-end close", "Reconcile payouts and overdue invoices at month end.", {
        ownerId: ava,
      }),
      type: "process",
    },
    {
      ...base(web, ws, "Northstar Web", "The product: workspace, invoices, and customer emails.", {
        ownerId: sam,
        tags: ["product"],
      }),
      type: "application",
      lifecycle: "active",
      criticality: "critical",
      vendor: "Northstar",
      url: "https://app.northstar.example",
    },
    {
      ...base(stripe, ws, "Stripe", "Card payments, payouts, and hosted checkout.", {
        ownerId: sam,
        tags: ["payments"],
      }),
      type: "application",
      lifecycle: "active",
      criticality: "critical",
      vendor: "Stripe",
      url: "https://stripe.com",
    },
    {
      ...base(postmark, ws, "Postmark", "Transactional email for confirmations and invoices.", {
        ownerId: sam,
        tags: ["email"],
      }),
      type: "application",
      lifecycle: "active",
      criticality: "high",
      vendor: "Postmark",
    },
    {
      ...base(stripeApi, ws, "Stripe Payments API", "Checkout sessions and invoice.paid webhooks."),
      type: "interface",
    },
    {
      ...base(postgres, ws, "PostgreSQL", "System of record for workspaces, invoices, and customers."),
      type: "technology",
    },
    {
      ...base(vercel, ws, "Vercel", "Hosts the web app."),
      type: "technology",
    },
  ];

  const references: Reference[] = [
    ref("ref_acq_self", ws, "contains", acquire, selfserve),
    ref("ref_del_ws", ws, "contains", deliver, workspaceCap),
    ref("ref_del_inv", ws, "contains", deliver, invoicing),
    ref("ref_pay_pay", ws, "contains", getpaid, payments),
    ref("ref_pay_dun", ws, "contains", getpaid, dunning),
    ref("ref_wf_su_acc", ws, "contains", wfSignup, wfAccount),
    ref("ref_wf_su_em", ws, "contains", wfSignup, wfEmail),
    ref("ref_wf_su_ws", ws, "contains", wfSignup, wfFirstWs),
    ref("ref_wf_inv_dr", ws, "contains", wfInvoice, wfDraft),
    ref("ref_wf_inv_se", ws, "contains", wfInvoice, wfSend),
    ref("ref_wf_co_li", ws, "contains", wfCollect, wfLink),
    ref("ref_wf_co_wh", ws, "contains", wfCollect, wfWebhook),
    ref("ref_wf_su_cap", ws, "realizes", wfSignup, selfserve),
    ref("ref_wf_inv_cap", ws, "realizes", wfInvoice, invoicing),
    ref("ref_wf_co_cap", ws, "realizes", wfCollect, payments),
    ref("ref_pr_q2c_inv", ws, "realizes", prQ2c, invoicing),
    ref("ref_pr_q2c_pay", ws, "realizes", prQ2c, getpaid),
    ref("ref_pr_close", ws, "realizes", prClose, dunning),
    ref("ref_web_self", ws, "supports", web, selfserve),
    ref("ref_web_ws", ws, "supports", web, workspaceCap),
    ref("ref_web_inv", ws, "supports", web, invoicing),
    ref("ref_web_pay", ws, "supports", web, payments),
    ref("ref_web_wf_su", ws, "supports", web, wfSignup),
    ref("ref_web_wf_inv", ws, "supports", web, wfInvoice),
    ref("ref_web_wf_co", ws, "supports", web, wfCollect),
    ref("ref_stripe_pay", ws, "supports", stripe, payments),
    ref("ref_stripe_wf", ws, "supports", stripe, wfCollect),
    ref("ref_pm_self", ws, "supports", postmark, selfserve),
    ref("ref_pm_inv", ws, "supports", postmark, invoicing),
    ref("ref_pm_wf_em", ws, "supports", postmark, wfEmail),
    ref("ref_pm_wf_se", ws, "supports", postmark, wfSend),
    ref("ref_web_stripe", ws, "integrates_with", web, stripe, {
      viaId: stripeApi,
      description: "Checkout session create; invoice.paid webhook back into Northstar Web",
    }),
    ref("ref_web_dep_stripe", ws, "depends_on", web, stripe),
    ref("ref_web_pm", ws, "uses", web, postmark),
    ref("ref_web_pg", ws, "uses", web, postgres),
    ref("ref_web_vercel", ws, "runs_on", web, vercel),
    ref("ref_acq_own", ws, "owned_by", acquire, ava),
    ref("ref_self_own", ws, "owned_by", selfserve, ava),
    ref("ref_del_own", ws, "owned_by", deliver, sam),
    ref("ref_ws_own", ws, "owned_by", workspaceCap, sam),
    ref("ref_inv_own", ws, "owned_by", invoicing, sam),
    ref("ref_gp_own", ws, "owned_by", getpaid, ava),
    ref("ref_pay_own", ws, "owned_by", payments, ava),
    ref("ref_dun_own", ws, "owned_by", dunning, ava),
    ref("ref_wfsu_own", ws, "owned_by", wfSignup, ava),
    ref("ref_wfacc_own", ws, "owned_by", wfAccount, ava),
    ref("ref_wfem_own", ws, "owned_by", wfEmail, ava),
    ref("ref_wfws_own", ws, "owned_by", wfFirstWs, sam),
    ref("ref_wfinv_own", ws, "owned_by", wfInvoice, sam),
    ref("ref_wfdr_own", ws, "owned_by", wfDraft, sam),
    ref("ref_wfse_own", ws, "owned_by", wfSend, sam),
    ref("ref_wfco_own", ws, "owned_by", wfCollect, ava),
    ref("ref_wfli_own", ws, "owned_by", wfLink, ava),
    ref("ref_wfwh_own", ws, "owned_by", wfWebhook, sam),
    ref("ref_q2c_own", ws, "owned_by", prQ2c, ava),
    ref("ref_close_own", ws, "owned_by", prClose, ava),
    ref("ref_web_own", ws, "owned_by", web, sam),
    ref("ref_stripe_own", ws, "owned_by", stripe, sam),
    ref("ref_pm_own", ws, "owned_by", postmark, sam),
  ];

  const welcome = wikiPage(
    "pg_welcome",
    ws,
    "Start here",
    0,
    doc(
      heading(1, "Northstar — how to read this workspace"),
      paragraph(
        text(
          "This is a sample product, not empty scaffolding. Northstar is a small invoicing SaaS for independent consultants. Use it to see how Lattice keeps the client story and the delivery story on the same graph.",
        ),
      ),
      heading(2, "Three layers"),
      bullets(
        [
          text("Catalog is the graph. Objects have types. Lines between them are typed references, not decoration."),
        ],
        [
          text("Pages are the narrative. Type @ to mention a catalog object so the prose cannot drift from the model."),
        ],
        [
          text(
            "Diagrams are views. Live maps layout from the graph. Boards remember positions. Connecting two apps writes a reference.",
          ),
        ],
      ),
      heading(2, "Client story versus delivery story"),
      paragraph(
        text("The client story is what the product must be able to do, and how a person moves through it: "),
        mention(acquire, "Acquire"),
        text(", "),
        mention(deliver, "Deliver"),
        text(", "),
        mention(getpaid, "Get paid"),
        text(", and the workflows "),
        mention(wfSignup, "Sign up"),
        text(", "),
        mention(wfInvoice, "Send an invoice"),
        text(", and "),
        mention(wfCollect, "Collect payment"),
        text("."),
      ),
      paragraph(
        text("The delivery story is how that is built: "),
        mention(web, "Northstar Web"),
        text(" talks to "),
        mention(stripe, "Stripe"),
        text(" through "),
        mention(stripeApi, "Stripe Payments API"),
        text(", sends mail with "),
        mention(postmark, "Postmark"),
        text(", stores data in "),
        mention(postgres, "PostgreSQL"),
        text(", and runs on "),
        mention(vercel, "Vercel"),
        text("."),
      ),
      heading(2, "Walk this sample"),
      tasks(
        task(false, text("Open Catalog and switch type filters — capabilities, then workflows, then applications.")),
        task(false, text("Open the Capability map. Apps and workflows sit inside the capability they serve.")),
        task(false, text("Open the Workflow map. Steps read left to right; systems are chips on the flow.")),
        task(false, text("Open the Application landscape, then the Get paid board. Connect is how you write an edge.")),
        task(false, text("Come back to pages and read How customers get paid, then How billing is built.")),
      ),
    ),
  );

  const product = wikiPage(
    "pg_product",
    ws,
    "The product",
    1,
    doc(
      heading(1, "What Northstar is"),
      paragraph(
        text(
          "Northstar is for a consultant who already has clients and is tired of Word invoices and chasing payment in email. The promise is simple: send a professional invoice, take a card, and see what is still unpaid.",
        ),
      ),
      heading(2, "Who it is for"),
      paragraph(
        text(
          "Independent designers, engineers, and small studios. One person signs up. They invite nobody in v1. The first invoice should go out the same afternoon.",
        ),
      ),
      heading(2, "What “good” looks like"),
      bullets(
        [text("A new consultant reaches a workspace without a sales call — that is "), mention(selfserve, "Self-serve signup"), text(".")],
        [text("They can name the studio and find invoices — that is "), mention(workspaceCap, "Workspace"), text(".")],
        [text("They can bill a client — that is "), mention(invoicing, "Invoicing"), text(".")],
        [text("The client can pay without a bank transfer thread — that is "), mention(payments, "Payments"), text(".")],
      ),
      paragraph(
        text("Product owner is "),
        mention(ava, "Ava Chen"),
        text(". Engineering owner is "),
        mention(sam, "Sam Okonkwo"),
        text("."),
      ),
    ),
    welcome.id,
  );

  const clientStory = wikiPage(
    "pg_client",
    ws,
    "How customers get paid",
    2,
    doc(
      heading(1, "How customers get paid"),
      paragraph(
        text("This is the client-facing story. A consultant does not care that checkout is Stripe. They care that an invoice they sent on Monday is paid by Friday."),
      ),
      heading(2, "The job"),
      paragraph(
        mention(getpaid, "Get paid"),
        text(" is the capability. Inside it, "),
        mention(payments, "Payments"),
        text(" is the happy path and "),
        mention(dunning, "Collections"),
        text(" is what happens when the happy path stalls."),
      ),
      heading(2, "The product flow"),
      paragraph(
        mention(wfCollect, "Collect payment"),
        text(" is the workflow the customer actually feels. First they "),
        mention(wfLink, "Open payment link"),
        text(". Then Northstar must "),
        mention(wfWebhook, "Mark invoice paid"),
        text(" without anyone typing “paid” by hand."),
      ),
      paragraph(
        text("Upstream of that, the consultant has already walked "),
        mention(wfInvoice, "Send an invoice"),
        text(": "),
        mention(wfDraft, "Draft invoice"),
        text(" then "),
        mention(wfSend, "Send invoice"),
        text(". Mail goes out through "),
        mention(postmark, "Postmark"),
        text(" so the payment link is in the same email as the PDF."),
      ),
      heading(2, "The operating process"),
      paragraph(
        mention(prQ2c, "Quote to cash"),
        text(" is how the company talks about this internally — from agreed work to cash. It is not a screen. It is the process that "),
        mention(invoicing, "Invoicing"),
        text(" and "),
        mention(getpaid, "Get paid"),
        text(" together have to support. "),
        mention(prClose, "Month-end close"),
        text(" is the monthly check that payouts and overdue invoices still match the books."),
      ),
    ),
    welcome.id,
  );

  const deliveryStory = wikiPage(
    "pg_delivery",
    ws,
    "How billing is built",
    3,
    doc(
      heading(1, "How billing is built"),
      paragraph(
        text("This is the delivery story for the same product. If you only read applications, you will miss why Stripe exists. If you only read capabilities, you will invent a second payment processor."),
      ),
      heading(2, "System of record"),
      paragraph(
        mention(web, "Northstar Web"),
        text(" owns invoices, customers, and workspace state in "),
        mention(postgres, "PostgreSQL"),
        text(". It runs on "),
        mention(vercel, "Vercel"),
        text(". It does not store cards."),
      ),
      heading(2, "Money movement"),
      paragraph(
        mention(web, "Northstar Web"),
        text(" integrates with "),
        mention(stripe, "Stripe"),
        text(" via "),
        mention(stripeApi, "Stripe Payments API"),
        text(". Create a Checkout Session when the client opens the link. Trust "),
        text("invoice.paid"),
        text(" (and the matching Checkout event) to "),
        mention(wfWebhook, "Mark invoice paid"),
        text(". Do not poll the Stripe dashboard. Do not add a second card form inside Northstar."),
      ),
      heading(2, "Why the interface is named"),
      paragraph(
        text("The via-interface on that edge is the rule. A new storefront, a mobile app, or a partner portal that needs to take payment should reuse "),
        mention(stripeApi, "Stripe Payments API"),
        text(" rather than opening a private Stripe account beside the product."),
      ),
      heading(2, "Mail"),
      paragraph(
        mention(web, "Northstar Web"),
        text(" uses "),
        mention(postmark, "Postmark"),
        text(" for confirm-email and for the invoice itself. If mail fails, "),
        mention(wfEmail, "Confirm email"),
        text(" and "),
        mention(wfSend, "Send invoice"),
        text(" both stall — that is an intentional coupling, not an accident."),
      ),
    ),
    welcome.id,
  );

  const principles = wikiPage(
    "pg_principles",
    ws,
    "Architecture principles",
    4,
    doc(
      heading(1, "Architecture principles"),
      paragraph(
        text("Write principles as constraints on the graph, not as slogans. If a new idea cannot be hung on an existing capability or workflow, it is a new product — or it does not belong."),
      ),
      heading(2, "Money stays behind an interface"),
      paragraph(
        mention(web, "Northstar Web"),
        text(" may depend on "),
        mention(stripe, "Stripe"),
        text(", but only through "),
        mention(stripeApi, "Stripe Payments API"),
        text(". No point-to-point “just this once” from a new app to Stripe."),
      ),
      heading(2, "Workflows before screens"),
      paragraph(
        text("A screen request must name the workflow step it serves. “Add a dashboard widget” is not a step of "),
        mention(wfCollect, "Collect payment"),
        text(". “Show paid/unpaid on the invoice” is."),
      ),
      heading(2, "One system of record for invoices"),
      paragraph(
        text("Invoice status lives in "),
        mention(web, "Northstar Web"),
        text(". Stripe can be ahead for a few seconds. The webhook is how we catch up. We do not dual-write status into a spreadsheet or a second database."),
      ),
    ),
  );

  const autoPages = components.map((component, index) => {
    if (component.id === web) {
      return autoPage(
        ws,
        component,
        100 + index,
        doc(
          paragraph(
            text("Product application. Owns the consultant-facing UI and the invoice record. Integrates with "),
            mention(stripe, "Stripe"),
            text(" via "),
            mention(stripeApi, "Stripe Payments API"),
            text(". Sam is the application owner."),
          ),
        ),
      );
    }
    if (component.id === wfCollect) {
      return autoPage(
        ws,
        component,
        100 + index,
        doc(
          paragraph(
            text("Client-facing flow for getting paid. Steps: "),
            mention(wfLink, "Open payment link"),
            text(" then "),
            mention(wfWebhook, "Mark invoice paid"),
            text(". Realizes "),
            mention(payments, "Payments"),
            text("."),
          ),
        ),
      );
    }
    return autoPage(ws, component, 100 + index);
  });

  const diagrams: Diagram[] = [
    {
      id: "dia_cap_map",
      workspaceId: ws,
      name: "Capability map",
      kind: "live",
      query: { preset: "capability_map" },
      view: { nodes: [], elk: { direction: "DOWN" }, edgeStyle: "smoothstep" },
      createdAt: T,
      updatedAt: T,
    },
    {
      id: "dia_wf_map",
      workspaceId: ws,
      name: "Workflow map",
      kind: "live",
      query: { preset: "workflow_map" },
      view: { nodes: [], elk: { direction: "RIGHT" }, edgeStyle: "smoothstep" },
      createdAt: T,
      updatedAt: T,
    },
    {
      id: "dia_app_map",
      workspaceId: ws,
      name: "Application landscape",
      kind: "live",
      query: { preset: "application_landscape" },
      view: { nodes: [], elk: { direction: "DOWN" }, edgeStyle: "smoothstep" },
      createdAt: T,
      updatedAt: T,
    },
    {
      id: "dia_board",
      workspaceId: ws,
      name: "Get paid board",
      kind: "board",
      view: {
        edgeStyle: "smoothstep",
        nodes: [
          {
            id: "n_group",
            kind: "group",
            position: { x: 48, y: 24 },
            size: { width: 640, height: 320 },
            text: "Billing",
          },
          { id: "n_web", kind: "component", componentId: web, position: { x: 80, y: 80 } },
          { id: "n_api", kind: "component", componentId: stripeApi, position: { x: 320, y: 80 } },
          { id: "n_stripe", kind: "component", componentId: stripe, position: { x: 560, y: 80 } },
          { id: "n_pm", kind: "component", componentId: postmark, position: { x: 80, y: 240 } },
          {
            id: "n_note",
            kind: "note",
            position: { x: 320, y: 240 },
            size: { width: 260, height: 96 },
            text: "Checkout session out. invoice.paid back. Do not add a second card form in the web app.",
          },
        ],
      },
      createdAt: T,
      updatedAt: T,
    },
  ];

  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: T,
    workspace: wsObj,
    components,
    references,
    pages: [welcome, product, clientStory, deliveryStory, principles, ...autoPages],
    diagrams,
  };
}
