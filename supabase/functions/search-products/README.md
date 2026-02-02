# Search Products Edge Function

Esta Edge Function atua como proxy inteligente entre o frontend React e a API do Nota Paraná (Menor Preço), fornecendo busca de produtos, categorias e combustíveis com cache, rate limiting e normalização de dados.

## Funcionalidades

### 1. Buscar Categorias e Produtos
**Endpoint:** `GET ?action=categories`

Busca categorias de produtos ou produtos diretamente baseado em um termo de pesquisa.

**Parâmetros:**
- `termo` (obrigatório): Termo de busca (ex: "cerveja corona", "dipirona")
- `raio` (opcional): Raio de busca em km (1-50, padrão: 3)
- `lat` (opcional): Latitude do ponto de busca
- `lon` (opcional): Longitude do ponto de busca

**Exemplo:**
```
GET /functions/v1/search-products?action=categories&termo=cerveja&raio=5&lat=-25.5&lon=-54.5
```

**Resposta:**
```json
{
  "categorias": [
    { "codigo": 123, "descricao": "Bebidas Alcoólicas" }
  ],
  "produtos": [],
  "resumo": null,
  "geohash": "6g3ntyecf",
  "cached": false
}
```

### 2. Buscar Produtos por Categoria
**Endpoint:** `GET ?action=products`

Busca produtos dentro de uma categoria específica.

**Parâmetros:**
- `termo` (obrigatório): Termo de busca
- `categoria` (opcional): Código da categoria
- `raio` (opcional): Raio de busca em km (1-50, padrão: 3)
- `ordem` (opcional): "preco" ou "distancia" (padrão: "preco")
- `lat` (opcional): Latitude
- `lon` (opcional): Longitude

**Exemplo:**
```
GET /functions/v1/search-products?action=products&termo=cerveja&categoria=123&raio=3&ordem=preco
```

**Resposta:**
```json
{
  "produtos": [
    {
      "id": "12345",
      "desc": "Cerveja Corona 330ml",
      "valor": 4.99,
      "estabelecimento": {
        "nome": "Supermercado ABC",
        "cnpj": "12345678000199",
        "endereco": "Rua Exemplo, 123",
        "coordenadas": { "lat": -25.5, "lon": -54.5 }
      },
      "distkm": 1.5,
      "tempo": "há 2 horas",
      "dataColeta": "2025-11-15T18:30:00Z"
    }
  ],
  "resumo": {
    "total": 15,
    "min": 4.50,
    "max": 6.99,
    "avg": 5.25
  },
  "geohash": "6g3ntyecf"
}
```

### 3. Buscar Preços de Combustíveis
**Endpoint:** `GET ?action=fuel`

Busca preços de combustíveis em postos próximos.

**Parâmetros:**
- `tipo` (obrigatório): Tipo de combustível
  - `1` = Gasolina Comum
  - `2` = Gasolina Aditivada
  - `3` = Etanol
  - `4` = Diesel
- `raio` (opcional): Raio de busca em km (1-50, padrão: 3)
- `lat` (opcional): Latitude
- `lon` (opcional): Longitude

**Exemplo:**
```
GET /functions/v1/search-products?action=fuel&tipo=1&raio=5
```

**Resposta:**
```json
{
  "postos": [
    {
      "id": "67890",
      "desc": "Gasolina Comum",
      "valor": 5.89,
      "estabelecimento": {
        "nome": "Posto Ipiranga",
        "cnpj": "98765432000100",
        "endereco": "Av. Brasil, 456",
        "coordenadas": { "lat": -25.48, "lon": -54.52 }
      },
      "distkm": 2.3,
      "tempo": "há 1 hora",
      "dataColeta": "2025-11-15T19:00:00Z"
    }
  ],
  "tipo": "Gasolina Comum",
  "resumo": {
    "total": 8,
    "min": 5.79,
    "max": 6.15,
    "avg": 5.92
  },
  "geohash": "6g3ntyecf"
}
```

### 4. Snapshot de Múltiplos Produtos
**Endpoint:** `POST ?action=snapshot`

Busca múltiplos produtos simultaneamente e agrupa resultados por estabelecimento.

**Body:**
```json
{
  "termos": ["cerveja corona", "dipirona", "paracetamol"],
  "raio": 5,
  "lat": -25.5,
  "lon": -54.5
}
```

**Resposta:**
```json
{
  "timestamp": "2025-11-15T20:00:00Z",
  "totalProdutos": 45,
  "totalEstabelecimentos": 12,
  "estabelecimentos": [
    {
      "nome": "Farmácia Popular",
      "cnpj": "11223344000155",
      "endereco": "Rua das Flores, 789",
      "coordenadas": { "lat": -25.51, "lon": -54.53 },
      "produtos": [
        {
          "desc": "Dipirona 500mg",
          "valor": 8.90,
          "tempo": "há 30 min",
          "dataColeta": "2025-11-15T19:30:00Z"
        }
      ]
    }
  ],
  "detalhes": [
    {
      "termo": "dipirona",
      "produtos": [...],
      "success": true
    }
  ]
}
```

## Recursos Avançados

### Cache Automático
- TTL: 15 minutos
- Máximo de 1000 entradas
- Cache por combinação única de parâmetros
- Resposta inclui flag `cached: true` quando servido do cache

### Rate Limiting
- 60 requisições por minuto por usuário
- Identificação via header `x-user-id`
- Resposta HTTP 429 quando limite excedido

### Retry Automático
- Máximo de 3 tentativas (1 inicial + 2 retries)
- Backoff exponencial entre tentativas
- Timeout de 30 segundos por requisição

### Geolocalização
- Conversão automática de lat/lon para geohash (9 caracteres)
- Fallback para Foz do Iguaçu quando coordenadas não fornecidas
- Validação de coordenadas (lat: -90 a 90, lon: -180 a 180)

## Uso no Frontend

### Via API direta:
```typescript
import { searchProducts } from '../lib/menorPrecoApi';

const response = await searchProducts({
  termo: 'dipirona',
  raio: 5,
  lat: -25.5,
  lon: -54.5
});
```

### Via Hook React:
```typescript
import { useMenorPrecoSearch } from '../hooks/useMenorPrecoSearch';

function MyComponent() {
  const { products } = useMenorPrecoSearch();

  const handleSearch = async () => {
    try {
      const result = await products.search({
        termo: 'dipirona',
        raio: 5
      });
      console.log(result);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      {products.loading && <p>Carregando...</p>}
      {products.error && <p>Erro: {products.error}</p>}
      {products.data && <pre>{JSON.stringify(products.data, null, 2)}</pre>}
    </div>
  );
}
```

## Tratamento de Erros

A função retorna erros com mensagens descritivas em português:

- **400 Bad Request**: Parâmetros inválidos ou ausentes
- **429 Too Many Requests**: Rate limit excedido
- **500 Internal Server Error**: Erro na API externa ou processamento
- **503 Service Unavailable**: API Menor Preço indisponível

Exemplo de resposta de erro:
```json
{
  "error": "Parâmetro 'termo' é obrigatório"
}
```

## Estrutura de Dados Normalizada

Todos os produtos retornados seguem a mesma estrutura:

```typescript
interface MenorPrecoProduct {
  id: string | number;
  desc: string;                    // Nome do produto
  valor: number;                   // Preço em reais
  estabelecimento: {
    nome: string;                  // Nome fantasia do estabelecimento
    cnpj: string | null;
    endereco: string | null;
    coordenadas: {
      lat: number;
      lon: number;
    } | null;
  };
  distkm: number;                  // Distância em km
  tempo: string;                   // Ex: "há 2 horas", "há 3 dias"
  dataColeta: string | null;       // ISO timestamp
}
```

## Considerações de Performance

1. **Cache**: Utilize o cache automático para evitar requisições desnecessárias
2. **Rate Limiting**: Implemente debounce no frontend para buscas com digitação
3. **Batch Requests**: Use snapshot para buscar múltiplos produtos simultaneamente
4. **Geolocalização**: Cache as coordenadas do usuário no frontend

## Segurança

- Função pública (verify_jwt: false) para permitir uso sem autenticação
- Rate limiting baseado em user_id quando disponível
- CORS configurado para aceitar requisições de qualquer origem
- Validação de todos os parâmetros de entrada
- Timeout em requisições externas para evitar hang
