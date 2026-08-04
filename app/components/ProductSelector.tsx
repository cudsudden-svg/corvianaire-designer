type Props = {
  onSelectProduct: (image: string) => void;
};

export default function ProductSelector({ onSelectProduct }: Props) {
  const products = [
    {
      name: "Custom Product",
      image: "/products/image.png",
    },
  ];

  return (
    <div>
      <h3>
        Products
      </h3>

      {products.map((product) => (
        <button
          key={product.name}
          onClick={() => onSelectProduct(product.image)}
        >
          {product.name}
        </button>
      ))}
    </div>
  );
}