// O <T> é "o tipo de cada item": hoje paciente, amanhã médico: Paginated<{ id, name, cpf, createdAt }>
export type Paginated<T> = {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

//A função recebe a fatia (data), o total e os números da página : ([...2 itens], 2, 1, 2)
export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> {
  return {
    // Monta { data, meta }
    data,
    meta: {
      total,
      page,
      pageSize,
      // Total de páginas = total ÷ tamanho, arredondado para cima : 57 e 20 → Math.ceil(2.85) = 3; 5 e 2 → 3; 0 e 20 → 0
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
