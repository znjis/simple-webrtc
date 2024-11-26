import {v4 as uuid} from "uuid"
import { useNavigate } from "react-router-dom";

const CreateRoom: React.FC = () => {
    const navigate = useNavigate();

    const createRoom = () => {
        const roomId = uuid();
        navigate(`/room/${roomId}`);
    };

    return (
        <button onClick={createRoom}>Create a Room</button>
    );
};

export default CreateRoom;