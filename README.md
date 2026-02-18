# 🛒 Product Expiry Manager (백화점 유제품 소비기한 관리 시스템)

백화점 식품관의 유제품 재고 관리 한계를 극복하기 위해 설계된 **가상 배치(Virtual Batching) 기반 재고 관리 시스템**입니다.
단순 수량 관리를 넘어, 소비기한별 재고 추적과 리스크 모니터링을 통해 선입선출(FIFO) 운영의 맹점을 보완하고 폐기율을 최소화합니다.

---

## 💡 프로젝트 배경 및 문제 정의

### 1. 핵심 문제 (The Problem)
* **데이터의 불투명성:** POS 시스템은 판매된 상품의 바코드만 인식할 뿐, "몇 월 며칠 자 우유가 팔렸는지"는 알 수 없습니다.
* **운영의 딜레마 (FIFO vs LIFO):** 매장은 선입선출(FIFO) 진열을 원칙으로 하지만, 고객은 신선한 상품을 후입선출(LIFO)하여 구매합니다. 이로 인해 **전산상 재고와 실제 유통기한 임박 상품 간의 괴리**가 발생합니다.
* **리스크 관리 부재:** 유통기한이 지난 상품이 진열대에 방치될 위험이 있으며, 이는 브랜드 신뢰도 하락으로 직결됩니다.

### 2. 해결 전략: 가상 배치 시스템 (Virtual Batching)
물리적 추적의 한계를 **논리적 알고리즘**으로 해결하기 위하여 설계했습니다.
* **배치(Batch) 단위 관리:** 재고를 단순 총량이 아닌 [유통기한, 수량] 객체 단위로 쪼개어 관리합니다.
* **워터폴 차감 (Waterfall Deduction):** 판매 발생 시 가장 오래된 재고가 먼저 팔린 것으로 가정하여 시스템 재고를 차감합니다.
* **모니터링 및 보정:** 임박 상품(D-3)을 자동 탐지하고, 관리자의 실사 데이터를 통해 가상 재고를 보정합니다.

---

## 🛠 기술 스택 (Tech Stack)

* **Framework:** NestJS (Node.js)
* **Language:** TypeScript
* **Database:** MongoDB & Mongoose
* **Architecture:** Layered Architecture (Controller - Service - Repository)

### MongoDB 사용
* RDBMS의 고비용 조인(Join) 연산을 제거하고, **Embedded Document** 구조를 채택했습니다.
* 상품(`Product`) 조회 시 수십 개의 유통기한 배치(`Batch`) 정보를 단일 쿼리로 가져와, 빈번한 POS 트래픽 처리에 최적화된 성능을 제공합니다.

---

## 📂 프로젝트 구조 및 구현 의도

```bash
src/
├── inventory/           # 재고 및 소비기한 관리 도메인
│   ├── dto/             # 데이터 전송 객체 (유효성 검증)
│   ├── schemas/         # MongoDB 스키마 (Inventory, Batch)
│   ├── inventory.controller.ts  # API 엔드포인트 정의
│   └── inventory.service.ts     # 핵심 비즈니스 로직 (워터폴 알고리즘)
├── products/            # 상품 마스터 데이터 도메인
│   ├── schemas/         # 상품 스키마 (Barcode Indexing)
│   └── products.service.ts      # 상품 등록 및 조회 (성능 최적화)
└── app.module.ts        # 모듈 통합
```

### 핵심 구현 포인트

**1. 워터폴 차감 알고리즘 (`InventoryService.sales`)**
* **문제:** 대량의 트래픽 환경에서 재고 차감 시, 전체 데이터를 탐색하는 O(N) 로직은 심각한 성능 저하를 유발합니다.
* **해결:** 전체 탐색(findAll())을 제거하고, 바코드 유니크 인덱스(findByBarcode())를 적용하여 O(1) 성능으로 최적화했습니다.

**2. 가상 배치 구조 (`Inventory Schema`)**
* 재고 도큐먼트 내에 `batches: [{ expiryDate, quantity }]` 배열을 내장했습니다.
* 이를 통해 입고 시 자동 정렬(FEFO) 및 판매 시 순차 차감을 단일 도큐먼트 내에서 효율적으로 처리합니다.

**3. 리스크 모니터링 (`InventoryService.findExpiring`)**
* MongoDB Aggregation Pipeline을 활용하여, 현재 시점 기준 **3일 이내 만료 예정인 상품**을 실시간으로 필터링하여 제공합니다.

## 📡 API 명세 (API Specifications)

### A. 상품 관리 (Products)

| Method | URI | Description |
| :--- | :--- | :--- |
| `POST` | `/products` | 신규 상품 등록 (바코드 중복 방지) |
| `GET` | `/products` | 전체 상품 목록 조회 |
| `GET` | `/products/:id` | 상품 상세 정보 조회 |

### B. 재고 및 소비기한 관리 (Inventory)

| Method | URI | Description | Logic |
| :--- | :--- | :--- | :--- |
| `POST` | `/inventory/inbound` | 입고 처리 | 동일 유통기한 합산 및 FEFO 정렬 |
| `POST` | `/inventory/sales` | 판매(차감) 처리 | **워터폴 차감 알고리즘** 적용 (오래된 재고 우선 차감) |
| `PATCH` | `/inventory/sync` | 재고 동기화 | 실사 데이터 기반 강제 보정 (Overwrite) |
| `GET` | `/inventory/expiring` | 임박 상품 조회 | D-3일 이내 만료 예정 상품 리스트 반환 (모니터링) |

## 🧪 핵심 검증 시나리오 (Verification)

본 시스템의 핵심 로직인 **성능 최적화(O(1) 조회)**와 **리스크 모니터링** 기능을 검증하기 위한 시나리오입니다.
DB가 비어있는 초기 상태에서 아래 순서대로 명령어를 실행하면 핵심 기능을 확인할 수 있습니다.

### Step 1. 테스트 데이터 세팅 (Data Setup)
검증을 위해 '성능 테스트 우유' 상품을 만들고, 유통기한이 다른 두 배치를 입고합니다.

```bash
# 1. 상품 등록 (Barcode: PERF-TEST-001)
curl -X POST http://localhost:3000/products \
  -H "Content-Type: application/json" \
  -d '{ "name": "성능 테스트 우유", "category": "Dairy", "price": 2500, "barcode": "PERF-TEST-001", "description": "리팩토링 검증용 상품" }'

# [중요] 위 응답에서 나온 "_id" 값을 복사하여 아래 <PRODUCT_ID> 자리에 넣어주세요.

# 2. 임박 상품 입고 (유통기한: 2026-02-19, 10개)
curl -X POST http://localhost:3000/inventory/inbound \
  -H "Content-Type: application/json" \
  -d '{ "productId": "<PRODUCT_ID>", "expiryDate": "2026-02-19", "quantity": 10 }'

# 3. 여유 상품 입고 (유통기한: 2026-03-03, 10개)
curl -X POST http://localhost:3000/inventory/inbound \
  -H "Content-Type: application/json" \
  -d '{ "productId": "<PRODUCT_ID>", "expiryDate": "2026-03-03", "quantity": 10 }'
```

### Step 2. 성능 및 워터폴 차감 검증 (Waterfall Logic)
findAll(O(N)) 대신 findByBarcode(O(1))를 사용하여 가장 오래된 배치를 찾아 차감합니다.
```bash
# [상황] 2/19일자(임박) 10개, 3/3일자(여유) 10개가 있는 상태에서 5개 판매 요청
curl -X POST http://localhost:3000/inventory/sales \
  -H "Content-Type: application/json" \
  -d '{ "barcode": "PERF-TEST-001", "quantity": 5 }'
```
검증 결과: 가장 임박한 2/19일자 배치가 5개 차감되고, 3/3일자 배치는 보존됨을 확인했습니다.

### Step 3. 리스크 모니터링 검증 (Risk Monitoring)
관리자가 3일 이내 만료 예정인 위험 재고를 즉시 파악할 수 있는지 확인합니다.

```bash
curl -X GET "http://localhost:3000/inventory/expiring?days=3"
```
검증 결과: 3/3일자(여유) 배치는 제외되고, 2/19일자(위험) 배치만 필터링되어 출력됨을 확인했습니다.


## 🔮 향후 발전 방향 (Future Improvements)

* **트랜잭션 고도화:** 현재는 로컬 개발 환경(Standalone DB)을 고려하여 비관적 락 개념의 순차 처리를 적용했으나, 배포 환경에서는 `startSession()`을 통한 완벽한 ACID 트랜잭션으로 전환 예정입니다.
* **이벤트 기반 아키텍처 (Event-Driven):** POS 트래픽 폭주에 대비하여 Kafka/RabbitMQ 메시지 큐 도입을 고려할 수 있습니다.
* **OCR 입고 자동화:** 모바일 카메라로 유통기한을 스캔하여 입고 정확도를 높이는 기능을 제안합니다.
