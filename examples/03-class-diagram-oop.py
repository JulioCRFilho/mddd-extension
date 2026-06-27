//@::classDiagram

//@Address
class Address:
    //@Address1:__init__ method
    def __init__(self, street: str, city: str, state: str, country: str, zip_code: str):
        self.street = street
        self.city = city
        self.state = state
        self.country = country
        self.zip_code = zip_code

    //@Address1.1:get_full_address method
    def get_full_address(self) -> str:
        return f"{self.street}, {self.city}, {self.state}, {self.country} {self.zip_code}"

//@User
class User:
    //@User1:__init__ method
    def __init__(self, name: str, email: str, phone: str):
        self.name = name
        self.email = email
        self.phone = phone
        self.addresses: list[Address] = []
        self.orders: list[Order] = []

    //@User1.1:add_address method
    //@--Address:has
    def add_address(self, address: Address):
        self.addresses.append(address)

    //@User1.2:get_default_address method
    def get_default_address(self):
        for addr in self.addresses:
            if addr.is_default:
                return addr
        return self.addresses[0] if self.addresses else None

    //@User1.3:place_order method
    //@->Order:Place order
    def place_order(self, cart):
        order = Order(self, cart.items, self.get_default_address())
        self.orders.append(order)
        return order

//@Customer
class Customer(User):
    //@Customer1:__init__ method
    def __init__(self, name: str, email: str, phone: str, loyalty_tier: str = "bronze"):
        super().__init__(name, email, phone)
        self.loyalty_tier = loyalty_tier
        self.loyalty_points = 0
        self.wishlist: list[Product] = []

    //@Customer1.1:add_to_wishlist method
    //@--Product:wishlist
    def add_to_wishlist(self, product):
        if product not in self.wishlist:
            self.wishlist.append(product)

    //@Customer1.2:calculate_discount method
    def calculate_discount(self, subtotal: float) -> float:
        tier_discounts = {"bronze": 0.0, "silver": 0.05, "gold": 0.10, "platinum": 0.15}
        return subtotal * tier_discounts.get(self.loyalty_tier, 0.0)

//@Admin
class Admin(User):
    //@Admin1:__init__ method
    def __init__(self, name: str, email: str, phone: str, admin_level: int):
        super().__init__(name, email, phone)
        self.admin_level = admin_level

    //@Admin1.1:manage_product method
    //@->Product:Manage
    def manage_product(self, product, action: str, **kwargs):
        if action == "update":
            product.update(**kwargs)
        elif action == "deactivate":
            product.active = False

//@Product
class Product:
    //@Product1:__init__ method
    def __init__(self, name: str, description: str, price: float, stock: int):
        self.name = name
        self.description = description
        self.price = price
        self.stock = stock
        self.active = True
        self.reviews: list[Review] = []

    //@Product1.1:update_stock method
    def update_stock(self, quantity: int):
        self.stock += quantity

    //@Product1.2:get_avg_rating method
    def get_avg_rating(self) -> float:
        if not self.reviews:
            return 0.0
        return sum(r.rating for r in self.reviews) / len(self.reviews)

//@Category
class Category:
    //@Category1:__init__ method
    def __init__(self, name: str, parent = None):
        self.name = name
        self.parent = parent
        self.subcategories: list[Category] = []
        self.products: list[Product] = []

    //@Category1.1:add_product method
    //@--Product:contains
    def add_product(self, product):
        if product not in self.products:
            self.products.append(product)

    //@Category1.2:add_subcategory method
    //@--Category:nested
    def add_subcategory(self, category):
        category.parent = self
        self.subcategories.append(category)

//@ShoppingCart
class ShoppingCart:
    //@ShoppingCart1:__init__ method
    def __init__(self, customer):
        self.customer = customer
        self.items: list[CartItem] = []

    //@ShoppingCart1.1:add_item method
    //@--CartItem:contains
    def add_item(self, product, quantity: int):
        for item in self.items:
            if item.product == product:
                item.quantity += quantity
                return
        self.items.append(CartItem(product, quantity))

    //@ShoppingCart1.2:get_subtotal method
    def get_subtotal(self) -> float:
        return sum(item.product.price * item.quantity for item in self.items)

//@CartItem
class CartItem:
    //@CartItem1:__init__ method
    def __init__(self, product, quantity: int):
        self.product = product
        self.quantity = quantity
        self.added_at = datetime.now()

//@Order
class Order:
    //@Order1:__init__ method
    def __init__(self, user, items, shipping_address):
        self.user = user
        self.items = items
        self.shipping_address = shipping_address
        self.status = "pending"
        self.payment = None
        self.shipping = None

    //@Order1.1:calculate_total method
    def calculate_total(self) -> float:
        subtotal = sum(item.product.price * item.quantity for item in self.items)
        if isinstance(self.user, Customer):
            discount = self.user.calculate_discount(subtotal)
            subtotal -= discount
        return subtotal

    //@Order1.2:confirm method
    def confirm(self) -> bool:
        for item in self.items:
            if item.product.stock < item.quantity:
                raise ValueError(f"Insufficient stock for {item.product.name}")
            item.product.update_stock(-item.quantity)
        self.status = "confirmed"
        return True

//@Payment
class Payment:
    //@Payment1:__init__ method
    def __init__(self, order, method: str):
        self.order = order
        self.method = method
        self.status = "pending"
        self.amount = order.calculate_total()
        order.payment = self

    //@Payment1.1:process method
    def process(self) -> bool:
        success = self.gateway.charge(self.amount, self.method)
        self.status = "completed" if success else "failed"
        return success

    //@Payment1.2:refund method
    def refund(self, amount = None):
        refund_amount = amount if amount else self.amount
        self.gateway.refund(self.transaction_id, refund_amount)
        self.status = "refunded"

//@Shipping
class Shipping:
    //@Shipping1:__init__ method
    def __init__(self, order, carrier: str, tracking_code = None):
        self.order = order
        self.carrier = carrier
        self.tracking_code = tracking_code
        self.status = "preparing"
        order.shipping = self

    //@Shipping1.1:update_tracking method
    def update_tracking(self, code: str):
        self.tracking_code = code
        self.status = "in_transit"

    //@Shipping1.2:mark_delivered method
    def mark_delivered(self):
        self.status = "delivered"
        self.order.status = "delivered"

//@Review
class Review:
    //@Review1:__init__ method
    def __init__(self, customer, product, rating: int, comment: str):
        self.customer = customer
        self.product = product
        self.rating = max(1, min(5, rating))
        self.comment = comment
        self.created_at = datetime.now()
        product.reviews.append(self)
