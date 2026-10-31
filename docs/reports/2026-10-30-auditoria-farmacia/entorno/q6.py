"""Q6: crea los datos simulados SOLO por la API local (http://localhost:3000).

Cada paso deja su llamada y su código HTTP en q6-calls.log y su resultado en q6-state.json,
así un paso que falla se puede corregir y reintentar sin repetir lo anterior.
Uso: python q6.py <paso> [<paso> ...]
"""
import io, json, os, sys, urllib.request, urllib.error, uuid

API = "http://localhost:3000"
HERE = os.path.dirname(os.path.abspath(__file__))
STATE_F = os.path.join(HERE, "q6-state.json")
LOG_F = os.path.join(HERE, "q6-calls.log")
SEED_TENANT = "1befcfea-44c0-563a-81cd-337ec6acc840"
DEPT_SCZ = None  # se resuelve por la API
PASS = "Audit.Local.2026"
MED_PARACETAMOL = "3545c7c6-1a54-5903-86df-6a1621dc2640"  # clinical:MEDICATION_PARACETAMOL
MED_AMOXICILINA = "9d90da56-a6c4-5669-b791-1022acb2ba6e"  # clinical:MEDICATION_AMOXICILINA

state = json.load(open(STATE_F)) if os.path.exists(STATE_F) else {}


def save():
    json.dump(state, open(STATE_F, "w"), indent=2, ensure_ascii=False)


def call(method, path, body=None, token=None, tenant=None, raw=None, ctype=None, quiet=False):
    data, headers = None, {}
    if raw is not None:
        data, headers["Content-Type"] = raw, ctype
    elif body is not None:
        data, headers["Content-Type"] = json.dumps(body).encode(), "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    if tenant:
        headers["X-Tenant-Id"] = tenant
    req = urllib.request.Request(API + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            status, payload = r.status, r.read()
    except urllib.error.HTTPError as e:
        status, payload = e.code, e.read()
    try:
        out = json.loads(payload) if payload and not payload.startswith(b"%PDF") else payload
    except ValueError:
        out = payload.decode(errors="replace")
    line = f"{method} {path} → {status}"
    with open(LOG_F, "a") as f:
        f.write(line + "\n")
    if not quiet:
        brief = out if isinstance(out, (dict, list)) else (f"<{len(out)} bytes>" if isinstance(out, bytes) else out)
        print(line, json.dumps(brief, ensure_ascii=False)[:600] if not isinstance(brief, str) else brief[:600])
    return status, out


def login(email):
    s, o = call("POST", "/iam/auth/login", {"email": email, "password": PASS}, quiet=True)
    print(f"POST /iam/auth/login ({email}) → {s}")
    assert s == 200, o
    return o["accessToken"]


def admin():
    s, o = call("POST", "/iam/auth/login", {"email": "admin@alovida.test", "password": "Audit.Admin.2026"}, quiet=True)
    assert s == 200, o
    return o["accessToken"]


def concept(vs_code, display):
    tok = admin()
    s, o = call("GET", f"/terminology/value-sets?q={vs_code}&limit=1", token=tok, quiet=True)
    vs = o["items"][0]["id"]
    s, o = call("GET", f"/terminology/value-sets/{vs}/$expand?count=500", token=tok, quiet=True)
    return next(i["conceptId"] for i in o["items"] if i["display"] == display)


def pdf_bytes(title):
    import pymupdf
    doc = pymupdf.open(); doc.new_page().insert_text((72, 72), title)
    return doc.tobytes()


def multipart(field, filename, content, ctype):
    b = uuid.uuid4().hex
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"{field}\"; filename=\"{filename}\"\r\n"
            f"Content-Type: {ctype}\r\n\r\n").encode() + content + f"\r\n--{b}--\r\n".encode()
    return body, f"multipart/form-data; boundary={b}"


# ------------------------------------------------------------------ pasos

def step_pharmacy():
    """Cuenta de farmacia por autorregistro con un nombre real del padrón AGEMED."""
    ids = {}
    for key in ("taxIdentifierFileId", "commerceRegistryFileId", "operatingLicenseFileId",
                "healthAuthorityCertificateFileId"):
        raw, ct = multipart("file", f"{key}.pdf", pdf_bytes(f"Documento simulado {key}"), "application/pdf")
        s, o = call("POST", "/iam/auth/upload-registration-document", raw=raw, ctype=ct)
        assert s in (200, 201), o
        ids[key] = o.get("fileId") or o.get("id")
    body = {
        "organization": {
            "code": "farmacia-chavez-audit", "legalName": "Farmacia Chavez S.A.",
            "tenantType": "PHARMACY", "legalEntityType": "UNIPERSONAL", "legalDocuments": ids,
            "countryConceptId": "9294e8fb-a776-5c37-b868-229e5794f401",  # BO
            "jurisdictionConceptId": "b393fed1-81e1-5f5c-b3a0-b55dfaff86d6",  # JURISDICTION_NATIONAL
            "pharmacy": {"latitude": -17.7833, "longitude": -63.1821,
                         "address": "Av. Cañoto 123, Santa Cruz (simulado)"},
        },
        "owner": {"email": "admin.farmacia-chavez@alovida.test", "password": PASS,
                  "name": "Rosa", "lastName": "Quispe"},
    }
    s, o = call("POST", "/iam/auth/register-organization", body)
    assert s in (200, 201), o
    state["pharmacy"] = o; save()


def step_verify_pharmacy():
    tid = state["pharmacy"]["tenantId"]
    s, o = call("POST", f"/admin/tenants/{tid}/verification", {}, token=admin(), tenant=tid)
    assert s in (200, 201), o
    state["pharmacy_verified"] = o; save()


def step_site():
    tok, pid = login("admin.farmacia-chavez@alovida.test"), state["pharmacy"]["pharmacyId"]
    s, o = call("POST", f"/pharmacies/{pid}/sites/bulk", {"mode": "CREATE", "rows": [
        {"code": "SUC-CENTRO", "name": "Sucursal Centro (simulada)", "latitude": -17.7833,
         "longitude": -63.1821, "pickupAvailable": True}]}, token=tok)
    assert s == 200 and o["results"][0]["outcome"] == "CREATED", o
    state["siteId"] = o["results"][0]["id"]; save()


def step_product():
    tok, pid = login("admin.farmacia-chavez@alovida.test"), state["pharmacy"]["pharmacyId"]
    s, o = call("POST", f"/pharmacies/{pid}/products", {
        "productCode": "AMOX-500", "medicationConceptId": MED_AMOXICILINA,
        "unitPrice": 35.5, "stock": 40}, token=tok)
    assert s in (200, 201), o
    state["productId"] = o["id"]; save()
    s, o = call("POST", f"/pharmacies/{pid}/price-lists", {"code": "PUBLICO", "priceListType": "PUBLIC"}, token=tok)
    assert s in (200, 201), o
    state["priceListId"] = o["id"]
    s, o = call("POST", f"/pharmacies/{pid}/price-lists/{o['id']}/prices",
                {"pharmacyProductId": state["productId"], "unitAmount": 35.5}, token=tok)
    assert s in (200, 201), o
    s, o = call("PUT", f"/pharmacies/{pid}/sites/{state['siteId']}/products/{state['productId']}/availability",
                {"available": True, "quantity": 12}, token=tok)
    assert s == 200, o
    state["availability"] = o; save()


def step_patient():
    body = {"nationalId": "7712345", "issuerAdministrativeAreaConceptId": concept("VS_BO_DEPARTMENT", "Chuquisaca"),
            "residenceMunicipalityConceptId": "5132db42-8cb1-52d6-88f5-0e9a04bdc94c",  # Sucre
            "password": PASS, "name": "Lucía", "lastName": "Mamani", "email": "paciente.lucia@alovida.test",
            "birthDate": "1990-04-12", "phone": "+591 71234567", "sexAtBirth": "FEMALE"}
    s, o = call("POST", "/iam/auth/register-patient", body)
    assert s in (200, 201), o
    state["patient"] = o; save()


def step_practitioner():
    body = {"email": "dr.andres@alovida.test", "password": PASS, "name": "Andrés", "lastName": "Rojas",
            "licenseNumber": "MP-SCZ-48213", "nationalId": "6623451",
            "issuerAdministrativeAreaConceptId": concept("VS_BO_DEPARTMENT", "Chuquisaca")}
    s, o = call("POST", "/iam/auth/register-practitioner", body)
    assert s in (200, 201), o
    state["practitioner"] = o; save()


def step_care():
    s, o = call("POST", "/authz/care-relationships", {
        "tenantId": SEED_TENANT, "patientProfileId": state["patient"]["patientProfileId"],
        "practitionerProfileId": state["practitioner"]["practitionerProfileId"],
        "relationshipType": "TREATING"}, token=admin(), tenant=SEED_TENANT)
    assert s in (200, 201), o
    state["care"] = o; save()


def step_rx():
    tok = login("dr.andres@alovida.test")
    pp = state["patient"]["patientProfileId"]
    s, o = call("POST", "/clinical/encounters/check-in", {"patientProfileId": pp, "tenantId": SEED_TENANT}, token=tok)
    assert s in (200, 201), o
    enc = o.get("id") or o.get("encounterId")
    state["encounterId"] = enc; save()
    s, o = call("POST", "/clinical/medication-requests", {
        "custodianTenantId": SEED_TENANT, "patientProfileId": pp, "medicationConceptId": MED_AMOXICILINA,
        "encounterId": enc, "doseText": "1 cápsula cada 8 horas por 7 días", "quantityDecimal": 21}, token=tok)
    assert s in (200, 201), o
    mr = o["id"]
    state["medicationRequestId"] = mr; save()
    s, o = call("POST", f"/clinical/medication-requests/{mr}/sign", {}, token=tok)
    state["sign"] = [s, o]
    s, o = call("POST", f"/clinical/medication-requests/{mr}/issue", {}, token=tok)
    assert s in (200, 201), o
    state["issued"] = o; save()


def step_pdf():
    tok = login("dr.andres@alovida.test")
    s, o = call("GET", f"/clinical/prescriptions/{state['medicationRequestId']}/pdf", token=tok)
    assert s == 200 and isinstance(o, bytes), o
    open(os.path.join(HERE, "receta.pdf"), "wb").write(o)


def step_share():
    tok = login("paciente.lucia@alovida.test")
    s, o = call("POST", "/clinical/prescription-shares", {"encounterId": state["encounterId"]}, token=tok)
    assert s in (200, 201), o
    state["share"] = o; save()
    call("GET", f"/public/prescription-shares/{o['token']}")
    call("GET", f"/clinical/prescription-shares/by-token/{o['token']}", token=tok)
    ptok = login("admin.farmacia-chavez@alovida.test")
    s, o2 = call("GET", f"/pharmacy/prescription-shares/{o['token']}", token=ptok)
    state["pharmacy_view"] = o2; save()


def step_erp():
    tok, pid = login("admin.farmacia-chavez@alovida.test"), state["pharmacy"]["pharmacyId"]
    s, o = call("POST", f"/pharmacies/{pid}/integration-connections",
                {"integrationMode": "BATCH", "pharmacySiteId": state["siteId"], "supportsStockQuery": True, "supportsPriceQuery": True}, token=tok)
    assert s in (200, 201), o
    cid = o["id"]
    state["connectionId"] = cid; save()
    s, o = call("POST", f"/pharmacies/{pid}/integration-connections/{cid}/product-mappings",
                {"pharmacyProductId": state["productId"], "externalProductCode": "ERP-0003"}, token=tok)
    s, o = call("POST", f"/pharmacies/{pid}/integration-connections/{cid}/sync", {}, token=tok)
    state["sync"] = [s, o]; save()


if __name__ == "__main__":
    for name in sys.argv[1:]:
        print(f"══ {name}")
        globals()["step_" + name]()
