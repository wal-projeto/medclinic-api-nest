import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @Type(() => Number) //Converte o texto da URL em número antes de validar	: "2" → 2; "abc" → NaN; "" → 0
  @IsInt() // Tem que ser número inteiro: 1.5 ✗; NaN ✗
  @Min(1) // No mínimo 1 : 0 ✗; -1 ✗
  @Max(Number.MAX_SAFE_INTEGER) // No máximo 9007199254740991: acima disso, o deslocamento estoura o banco:100000000000000000 ✗ (400)
  page: number = 1; // Valor padrão: se page não vier na URL, fica 1

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20; // Sem pageSize padrão -> 20
}

/**
Saídas reais da cópia:
?page=abc -→ 400 "page must not be less than 1; page must be an integer number";
?pageSize= (vazio) -→ 400 "pageSize must not be less than 1", porque o texto vazio vira 0;
?page=1&page=2 -→ 400, porque o page repetido chega como uma lista, e lista não é inteiro.
*/
