import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

const ShortWishRedirect = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    // Always send viewers to the public wishlist in gifter mode
    navigate(`/wishlist/${id}?mode=gifter`, { replace: true });
  }, [id, navigate]);

  return null;
};

export default ShortWishRedirect;
