import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';
export declare class ProductsController {
    private readonly productsService;
    constructor(productsService: ProductsService);
    create(createProductDto: CreateProductDto): Promise<import("./schemas/product.schema").Product>;
    findAll(): Promise<import("./schemas/product.schema").Product[]>;
    findOne(id: string): Promise<import("./schemas/product.schema").Product>;
}
