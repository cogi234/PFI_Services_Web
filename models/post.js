import Model from './model.js';
import Repository from './repository.js';
import User from './user.js';

export default class Post extends Model {
    constructor() {
        super(true /* secured Id */);

        this.addField('Title', 'string');
        this.addField('Text', 'string');
        this.addField('Category', 'string');
        this.addField('Image', 'asset');
        this.addField('Date', 'integer');
        this.addField('OwnerId', 'string');

        this.setKey("Title");
    }
    
    bindExtraData(instance) {
        instance = super.bindExtraData(instance);
        

        usersRepository = new Repository(new UserModel());
        owner = usersRepository.get(instance.OwnerId);

        if (owner != null) {
            instance.OwnerName = owner.Name;
            instance.OwnerAvatar = owner.Avatar;
        } else {
            instance.OwnerName = null;
            instance.OwnerAvatar = null;
        }

        instance.OwnerId = null;
        return instance;
    }
}